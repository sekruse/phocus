ZIP_FILE = phocus.zip
SOURCES = $(shell find . -type f \( -name "manifest.json" -o -name "*.png" -o -name "*.js" -o -name "*.css" -o -name "*.html" \))

all: $(ZIP_FILE)

$(ZIP_FILE): $(SOURCES)
	@echo "Creating archive: $(ZIP_FILE)..."
	zip $(ZIP_FILE) $(SOURCES)
	@echo "Successfully created $(ZIP_FILE)."

clean:
	@echo "Cleaning up generated files..."
	rm -f $(ZIP_FILE)
	@echo "Removed $(ZIP_FILE)."

.PHONY: all clean

