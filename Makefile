CSS_SRC := $(sort $(wildcard css-src/*.css))
JS_SRC  := $(sort $(wildcard js-src/*.js))

all: static/sf/sf.css static/sf/sf.js

static/sf/sf.css: $(CSS_SRC)
	@echo "  CSS  sf.css ($(words $(CSS_SRC)) files)"
	@cat $(CSS_SRC) > $@

static/sf/sf.js: $(JS_SRC)
	@echo "  JS   sf.js ($(words $(JS_SRC)) files)"
	@cat $(JS_SRC) > $@

clean:
	rm -f static/sf/sf.css static/sf/sf.js

.PHONY: all clean
