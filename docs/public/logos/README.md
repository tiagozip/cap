# Logo Guidelines

To add your organization's logo to the "Who's Using Cap" page:

## Requirements

- **Format**: SVG only
- **Orientation**: Horizontal/landscape preferred
- **Size**: The logo will be displayed at a max height of 48px and max width of 160px. Your SVG viewBox should reflect these proportions.
- **Colors**: Any colors are fine — logos are displayed in grayscale by default and switch to full color on hover.
- **Optimization**: Remove unnecessary metadata, comments, and minify paths. Tools like [SVGO](https://github.com/svg/svgo) can help.

## How to Add

1. Place your SVG file in this directory (`docs/public/logos/`)
2. Add your entry to [`docs/.vitepress/theme/data/showcase.ts`](../.vitepress/theme/data/showcase.ts):
   ```ts
   {
     name: 'Your Company',
     logo: '/logos/your-company.svg',
     url: 'https://your-company.com',
   }
   ```
3. Open a pull request

We'll review and merge. Thank you for supporting Cap!
