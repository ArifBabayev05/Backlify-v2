# Backlify v2

Dynamic API generator using Mistral AI and Supabase.

## Deployment to Render.com

Follow these steps to deploy the application to Render.com:

### Option 1: Manual Deployment

1. Sign up or log in to [Render.com](https://render.com)
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository or upload your code directly
4. Configure the service:
   - **Name**: `backlify-v2` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Select the closest to your users
   - **Branch**: `main` (or your default branch)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add the following environment variables:
   - `PORT`: 10000
   - `NODE_ENV`: production
   - `MISTRAL_API_KEY`: Your Mistral API key
   - `MISTRAL_MODEL`: mistral-small-latest
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_KEY`: Your Supabase key
   - `DB_CONNECTION_STRING`: Your Supabase database connection string
6. Click "Create Web Service"

### Option 2: Blueprint Deployment (render.yaml)

1. Make sure the `render.yaml` file is in your repository
2. Log in to [Render.com](https://render.com)
3. Click on "New" and select "Blueprint"
4. Connect the repository containing the `render.yaml` file
5. Review the configuration and click "Apply"
6. Fill in the required environment variables that are marked as `sync: false`

## After Deployment

- The application will be available at `https://backlify-v2.onrender.com` (or your custom name)
- Check the logs in the Render dashboard for any issues
- You can manage environment variables in the dashboard at any time
- Scale up your plan if needed for production use

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required environment variables (see above)
4. Run the development server: `npm run dev`

## Environment Variables

- `PORT`: Server port (default: 3000)
- `MISTRAL_API_KEY`: Your Mistral AI API key
- `MISTRAL_MODEL`: The Mistral model to use (default: mistral-small-latest)
- `NODE_ENV`: Environment (development/production)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase API key
- `DB_CONNECTION_STRING`: Database connection string 