//! Framework-neutral access to the embedded `/sf/*` asset tree.
//!
//! This module is available without the optional `axum` feature. Hosts using
//! another HTTP framework can call [`get`] and translate the returned metadata
//! into their own response type.

use include_dir::{include_dir, Dir, DirEntry};
use std::{error::Error, fmt, sync::LazyLock};

static ASSETS: Dir = include_dir!("$CARGO_MANIFEST_DIR/static/sf");
static PATHS: LazyLock<Vec<&'static str>> = LazyLock::new(|| {
    let mut paths = Vec::new();
    collect_paths(ASSETS.entries(), &mut paths);
    paths.sort_unstable();
    paths
});

/// Error returned by [`get`] when an asset path cannot be served.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[non_exhaustive]
pub enum AssetError {
    /// The path is not a valid `/sf`-relative asset path.
    InvalidPath,
    /// The path is valid but no embedded asset exists at that location.
    NotFound,
}

impl fmt::Display for AssetError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPath => f.write_str("invalid embedded asset path"),
            Self::NotFound => f.write_str("embedded asset not found"),
        }
    }
}

impl Error for AssetError {}

/// An embedded SolverForge UI asset plus the HTTP metadata used by the Axum
/// adapter.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[non_exhaustive]
pub struct UiAsset {
    /// Canonical path relative to `/sf`.
    path: &'static str,
    /// HTTP `Content-Type` value.
    content_type: &'static str,
    /// HTTP `Cache-Control` value.
    cache_control: &'static str,
    /// Embedded file contents.
    bytes: &'static [u8],
}

impl UiAsset {
    /// Returns the canonical path relative to `/sf`.
    pub fn path(&self) -> &'static str {
        self.path
    }

    /// Returns the HTTP `Content-Type` value for this asset.
    pub fn content_type(&self) -> &'static str {
        self.content_type
    }

    /// Returns the HTTP `Cache-Control` value for this asset.
    pub fn cache_control(&self) -> &'static str {
        self.cache_control
    }

    /// Returns the embedded file contents.
    pub fn bytes(&self) -> &'static [u8] {
        self.bytes
    }
}

/// Looks up an embedded asset by `/sf`-relative path.
///
/// Returns [`AssetError::InvalidPath`] for unsafe paths, including absolute
/// paths, empty paths, backslash paths, duplicate slashes, and `.`/`..`
/// segments. Returns [`AssetError::NotFound`] for valid paths that are not
/// embedded.
pub fn get(path: &str) -> Result<UiAsset, AssetError> {
    let path = validate_path(path)?;
    let file = ASSETS.get_file(path).ok_or(AssetError::NotFound)?;
    let path = file.path().to_str().ok_or(AssetError::NotFound)?;
    Ok(UiAsset {
        path,
        content_type: content_type_from_path(path),
        cache_control: cache_control_from_path(path),
        bytes: file.contents(),
    })
}

/// Returns all embedded `/sf`-relative asset paths in stable sorted order.
pub fn paths() -> &'static [&'static str] {
    PATHS.as_slice()
}

/// Returns the crate version that produced this embedded asset set.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn collect_paths(entries: &'static [DirEntry<'static>], paths: &mut Vec<&'static str>) {
    for entry in entries {
        match entry {
            DirEntry::Dir(dir) => collect_paths(dir.entries(), paths),
            DirEntry::File(file) => {
                if let Some(path) = file.path().to_str() {
                    paths.push(path);
                }
            }
        }
    }
}

fn validate_path(path: &str) -> Result<&str, AssetError> {
    if path.is_empty()
        || path.starts_with('/')
        || path.starts_with('\\')
        || path.contains('\\')
        || path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(AssetError::InvalidPath);
    }
    Ok(path)
}

fn content_type_from_path(path: &str) -> &'static str {
    match path.rsplit('.').next() {
        Some("css") => "text/css; charset=utf-8",
        Some("js") | Some("mjs") => "application/javascript; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ttf") => "font/ttf",
        Some("eot") => "application/vnd.ms-fontobject",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("ico") => "image/x-icon",
        Some("json") | Some("map") => "application/json",
        Some("html") => "text/html; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn cache_control_from_path(path: &str) -> &'static str {
    if is_immutable(path) {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=3600"
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
                && matches!(ext, "css" | "js" | "mjs")
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_assets_with_metadata() {
        let asset = get("sf.js").expect("sf.js should be embedded");
        assert_eq!(asset.path(), "sf.js");
        assert_eq!(
            asset.content_type(),
            "application/javascript; charset=utf-8"
        );
        assert_eq!(asset.cache_control(), "public, max-age=3600");
        assert!(!asset.bytes().is_empty());

        let css = get("sf.css").expect("sf.css should be embedded");
        assert_eq!(css.content_type(), "text/css; charset=utf-8");
    }

    #[test]
    fn returns_version_and_paths() {
        assert_eq!(version(), env!("CARGO_PKG_VERSION"));
        let paths = paths();
        assert!(paths.contains(&"sf.js"));
        assert!(paths.contains(&"sf.css"));
        assert!(paths.contains(&"img/ouroboros.svg"));
    }

    #[test]
    fn returns_not_found_for_missing_assets() {
        assert_eq!(get("does-not-exist.js"), Err(AssetError::NotFound));
    }

    #[test]
    fn rejects_invalid_paths() {
        assert_eq!(get(""), Err(AssetError::InvalidPath));
        assert_eq!(get("./sf.js"), Err(AssetError::InvalidPath));
        assert_eq!(get("/sf.js"), Err(AssetError::InvalidPath));
        assert_eq!(get("sf//sf.js"), Err(AssetError::InvalidPath));
        assert_eq!(get("sf.js/"), Err(AssetError::InvalidPath));
        assert_eq!(get("../sf.js"), Err(AssetError::InvalidPath));
        assert_eq!(get("vendor/../sf.js"), Err(AssetError::InvalidPath));
        assert_eq!(
            get(r"vendor\leaflet\leaflet.js"),
            Err(AssetError::InvalidPath)
        );
    }

    #[test]
    fn paths_are_sorted() {
        let paths = paths();
        let mut sorted = paths.to_vec();
        sorted.sort_unstable();
        assert_eq!(paths, sorted.as_slice());
    }

    #[test]
    fn cache_and_content_type_rules_match_route_contract() {
        assert_eq!(
            content_type_from_path("styles/sf.css"),
            "text/css; charset=utf-8"
        );
        assert_eq!(
            content_type_from_path("scripts/sf.js"),
            "application/javascript; charset=utf-8"
        );
        assert_eq!(
            content_type_from_path("scripts/sf.mjs"),
            "application/javascript; charset=utf-8"
        );
        assert_eq!(content_type_from_path("img/logo.svg"), "image/svg+xml");
        assert_eq!(content_type_from_path("data.json"), "application/json");
        assert_eq!(content_type_from_path("bundle.map"), "application/json");

        assert_eq!(
            cache_control_from_path("fonts/jetbrains-mono.woff2"),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(
            cache_control_from_path("vendor/leaflet/leaflet.js"),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(
            cache_control_from_path("img/ouroboros.svg"),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(
            cache_control_from_path("sf.0.7.0.css"),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(
            cache_control_from_path("sf.0.7.0.js"),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(
            cache_control_from_path("sf.0.7.0.mjs"),
            "public, max-age=31536000, immutable"
        );
        assert_eq!(cache_control_from_path("sf.css"), "public, max-age=3600");
    }
}
