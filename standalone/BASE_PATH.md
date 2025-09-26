# BASE_PATH Configuration

Cap Standalone now supports hosting at a different root URL using the `BASE_PATH` environment variable.

## Usage

Set the `BASE_PATH` environment variable to the desired path prefix:

```bash
# Host at /cap
BASE_PATH=/cap bun run src/index.js

# Host at /security/cap
BASE_PATH=/security/cap bun run src/index.js
```

## Docker

```bash
# Basic usage with BASE_PATH
docker run -e BASE_PATH=/cap -e ADMIN_KEY=your_admin_key tiago2/cap:latest

# Using docker-compose
# docker-compose.yml
version: '3.8'
services:
  cap:
    image: tiago2/cap:latest
    ports:
      - "3000:3000"
    environment:
      - BASE_PATH=/cap
      - ADMIN_KEY=your_admin_key
```

## Environment Variables

Add to your `.env` file:

```bash
BASE_PATH=/cap
ADMIN_KEY=your_admin_key
```

## Widget Configuration

When using the Cap widget with a custom BASE_PATH, you must include the base path in the `data-cap-api-endpoint` attribute:

```html
<!-- For BASE_PATH=/cap -->
<cap-widget 
  data-cap-api-endpoint="/cap/YOUR_SITE_KEY/"
  data-cap-hidden-field-name="cap-token">
</cap-widget>

<!-- For no BASE_PATH (root) -->
<cap-widget 
  data-cap-api-endpoint="/YOUR_SITE_KEY/"
  data-cap-hidden-field-name="cap-token">
</cap-widget>
```

**Important:** The widget does not automatically detect the BASE_PATH. You must manually include it in the API endpoint configuration.

## Notes

- The BASE_PATH is automatically normalized to start with `/` and not end with `/`
- All API endpoints, assets, and frontend routes will be prefixed with the BASE_PATH
- The login page and admin interface will automatically work with the configured BASE_PATH
- Widget configuration must be updated manually to include the BASE_PATH