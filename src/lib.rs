use axum::{
    extract::Path,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use include_dir::{include_dir, Dir};

static ASSETS: Dir = include_dir!("$CARGO_MANIFEST_DIR/static/sf");

pub fn routes() -> Router {
    Router::new().route("/sf/{*path}", get(serve_asset))
}

async fn serve_asset(Path(path): Path<String>) -> Response {
    let Some(file) = ASSETS.get_file(&path) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let mime = mime_from_path(&path);
    let cache = if is_immutable(&path) {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=3600"
    };

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, mime), (header::CACHE_CONTROL, cache)],
        file.contents(),
    )
        .into_response()
}

fn mime_from_path(path: &str) -> &'static str {
    match path.rsplit('.').next() {
        Some("css") => "text/css; charset=utf-8",
        Some("js") => "application/javascript; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ttf") => "font/ttf",
        Some("eot") => "application/vnd.ms-fontobject",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("ico") => "image/x-icon",
        Some("json") => "application/json",
        Some("html") => "text/html; charset=utf-8",
        Some("map") => "application/json",
        _ => "application/octet-stream",
    }
}

fn is_immutable(path: &str) -> bool {
    path.starts_with("fonts/")
        || path.starts_with("vendor/")
        || path.starts_with("img/")
        || is_versioned_bundle(path)
}

fn is_versioned_bundle(path: &str) -> bool {
    path.strip_prefix("sf.")
        .and_then(|rest| rest.rsplit_once('.'))
        .map(|(version, ext)| {
            !version.is_empty()
                && version.chars().all(|ch| {
                    ch.is_ascii_digit()
                        || ch == '.'
                        || ch == '-'
                        || ch == '+'
                        || ch.is_ascii_alphabetic()
                })
                && matches!(ext, "css" | "js")
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        http::{Method, Request, StatusCode},
    };
    use tower::util::ServiceExt;

    #[test]
    fn versioned_bundles_are_detected() {
        assert!(is_versioned_bundle("sf.0.2.0.css"));
        assert!(is_versioned_bundle("sf.0.2.0.js"));
        assert!(is_versioned_bundle("sf.0.2.0-beta.1.js"));
        assert!(is_versioned_bundle("sf.0.2.0+build.7.css"));
        assert!(!is_versioned_bundle("sf.css"));
        assert!(!is_versioned_bundle("sf.js"));
        assert!(!is_versioned_bundle("vendor/sf.0.2.0.js"));
    }

    #[test]
    fn caches_paths_are_predicted_correctly() {
        assert_eq!(mime_from_path("styles/sf.css"), "text/css; charset=utf-8");
        assert_eq!(
            mime_from_path("scripts/sf.js"),
            "application/javascript; charset=utf-8"
        );
        assert_eq!(mime_from_path("img/logo.svg"), "image/svg+xml");
        assert_eq!(mime_from_path("font.woff2"), "font/woff2");

        assert!(is_immutable("fonts/jetbrains-mono.woff2"));
        assert!(is_immutable("vendor/leaflet/leaflet.js"));
        assert!(is_immutable("img/solverforge-logo.svg"));
        assert!(is_immutable("sf.0.2.0.css"));
        assert!(is_immutable("sf.0.2.0+build.7.js"));
        assert!(!is_immutable("sf.css"));
    }

    #[test]
    fn mime_detection_still_works_for_versioned_assets() {
        assert_eq!(mime_from_path("sf.0.2.0.css"), "text/css; charset=utf-8");
        assert_eq!(
            mime_from_path("sf.0.2.0+build.7.js"),
            "application/javascript; charset=utf-8"
        );
    }

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
}
