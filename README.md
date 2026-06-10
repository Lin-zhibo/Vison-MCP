##  Supported Tools

This server implements the Model Context Protocol and can be used with any MCP-compatible client. Currently provides the following tools:

- **`ui_to_artifact`** - Turn UI screenshots into code, prompts, specs, or descriptions.
- **`extract_text_from_screenshot`** - OCR screenshots for code, terminals, docs, and general text.
- **`diagnose_error_screenshot`** - Analyze error snapshots and propose actionable fixes.
- **`understand_technical_diagram`** - Interpret architecture, flow, UML, ER, and system diagrams.
- **`analyze_data_visualization`** - Read charts and dashboards to surface insights and trends.
- **`ui_diff_check`** - Compare two UI shots to flag visual or implementation drift.
- **`image_analysis`** - General-purpose image understanding when other tools don’t fit.
- **`video_analysis`** - Inspect videos (local/remote ≤8 MB; MP4/MOV/M4V) to describe scenes, moments, and entities.



##  Environment Variable Configuration

- **VISIONAI_API_KEY**
- **VISIONAI_BASE_URL**
- **VISIONAI_MODEL_NAME**