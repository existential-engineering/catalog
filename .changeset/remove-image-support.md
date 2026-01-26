---
"catalog": patch
---

Remove unused image support from catalog schema

- Removed Image interface from types
- Removed manufacturer_images, software_images, hardware_images tables from SQL schema
- Removed image insertion logic from build script
- Removed ImageSchema validation

No YAML files were using images, so this is purely a schema/code cleanup with no data impact.
