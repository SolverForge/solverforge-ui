const REGEX = /^version = "(.*)"/m

module.exports.readVersion = function (contents) {
  const match = contents.match(REGEX)
  return match ? match[1] : undefined
}

module.exports.writeVersion = function (contents, version) {
  return contents.replace(REGEX, `version = "${version}"`)
}
