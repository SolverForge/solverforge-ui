#[cfg(feature = "axum")]
use axum::{
    extract::Path,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};

pub mod assets;

#[cfg(feature = "axum")]
pub fn routes() -> Router {
    Router::new().route("/sf/{*path}", get(serve_asset))
}

#[cfg(feature = "axum")]
async fn serve_asset(Path(path): Path<String>) -> Response {
    let Ok(asset) = assets::get(&path) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, asset.content_type()),
            (header::CACHE_CONTROL, asset.cache_control()),
        ],
        asset.bytes(),
    )
        .into_response()
}

#[cfg(all(test, feature = "axum"))]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        http::{Method, Request, StatusCode},
    };
    use tower::util::ServiceExt;

    #[tokio::test]
    async fn serves_assets_with_expected_headers() {
        let app = routes();

        let immutable_resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/sf/fonts/jetbrains-mono.woff2")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(immutable_resp.status(), StatusCode::OK);
        assert_eq!(
            immutable_resp.headers().get("cache-control").unwrap(),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(
            immutable_resp.headers().get("content-type").unwrap(),
            "font/woff2"
        );
        assert!(!to_bytes(immutable_resp.into_body(), 16_000_000)
            .await
            .unwrap()
            .is_empty());

        let mutable_resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/sf/sf.css")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(mutable_resp.status(), StatusCode::OK);
        assert_eq!(
            mutable_resp.headers().get("cache-control").unwrap(),
            "public, max-age=3600"
        );
        assert_eq!(
            mutable_resp.headers().get("content-type").unwrap(),
            "text/css; charset=utf-8"
        );
        assert!(!to_bytes(mutable_resp.into_body(), 16_000_000)
            .await
            .unwrap()
            .is_empty());

        let missing_resp = app
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/sf/does-not-exist")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(missing_resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn serves_top_level_assets_with_short_cache_and_expected_mime() {
        let response = routes()
            .oneshot(
                Request::builder()
                    .uri("/sf/sf.css")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/css; charset=utf-8"
        );
        assert_eq!(
            response.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=3600"
        );

        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let css = String::from_utf8(body.to_vec()).unwrap();
        assert!(css.contains("--sf-emerald-50"));
        assert!(css.contains(".sf-gantt-split"));
    }

    #[tokio::test]
    async fn serves_immutable_assets_with_long_cache_and_expected_mime() {
        let image = routes()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/sf/img/ouroboros.svg")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(image.status(), StatusCode::OK);
        assert_eq!(
            image.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/svg+xml"
        );
        assert_eq!(
            image.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=31536000, immutable"
        );

        let vendor = routes()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/sf/vendor/frappe-gantt/frappe-gantt.min.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(vendor.status(), StatusCode::OK);
        assert_eq!(
            vendor.headers().get(header::CONTENT_TYPE).unwrap(),
            "application/javascript; charset=utf-8"
        );
        assert_eq!(
            vendor.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=31536000, immutable"
        );
    }

    #[tokio::test]
    async fn returns_not_found_for_missing_assets() {
        let response = routes()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/sf/does-not-exist.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
