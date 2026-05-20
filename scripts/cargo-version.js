const REGEX = /^version = "(.*)"/m;

export function readVersion(contents) {
  const match = contents.match(REGEX);
  return match ? match[1] : undefined;
}

export function writeVersion(contents, version) {
  return contents.replace(REGEX, `version = "${version}"`);
}
