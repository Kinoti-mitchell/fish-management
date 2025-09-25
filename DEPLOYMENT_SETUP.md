# Deployment Setup Guide

## GitHub Secrets Configuration

To deploy this application to GitHub Pages, you need to set up the following secrets in your GitHub repository:

### Required Secrets

1. **VITE_SUPABASE_URL**
   - Value: `https://pgpazwlejhysxabtkifz.supabase.co`

2. **VITE_SUPABASE_ANON_KEY**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0`

### How to Set Up GitHub Secrets

1. Go to your GitHub repository: `https://github.com/Kinoti-mitchell/fish-management`
2. Click on **Settings** tab
3. In the left sidebar, click on **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret:
   - Name: `VITE_SUPABASE_URL`
   - Secret: `https://pgpazwlejhysxabtkifz.supabase.co`
6. Click **Add secret**
7. Repeat for `VITE_SUPABASE_ANON_KEY`

### Local Development Setup

For local development, run:

```bash
npm run setup-env
```

This will create a `.env` file with the necessary environment variables.

### Build and Deploy

Once secrets are configured:

1. Push changes to the `main` branch
2. GitHub Actions will automatically build and deploy
3. The app will be available at: `https://kinoti-mitchell.github.io/fish-management`

### Troubleshooting

If you see "Missing Supabase environment variables" errors:

1. Verify GitHub secrets are set correctly
2. Check the GitHub Actions build logs
3. Ensure the workflow file is updated with environment variables
4. For local development, ensure `.env` file exists (run `npm run setup-env`)

## Screen Layout Configuration

The application uses a responsive layout system:

- **Mobile**: Fixed header with content below
- **Desktop**: 15% navigation sidebar, 85% content area
- **No spillage**: All content properly contained within viewport
- **Responsive**: Adapts to all screen sizes

### Layout Features

- ✅ **75%/15% split** for laptops and desktops
- ✅ **No content spillage** - everything fits within screen bounds
- ✅ **Responsive design** - works on all device sizes
- ✅ **Proper z-index layering** - no overlapping elements
- ✅ **Safe area support** - works with device notches/rounded corners
