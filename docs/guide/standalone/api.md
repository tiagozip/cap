# API

Standalone mode offers a simple API for creating, viewing, and managing keys and sessions. First, login to your Cap Standalone dashboard and get an API key from **Settings** → **API Keys**. Give it a name and tap "Create".

Once your key is created, save it somewhere safe, as you won't be able to see it again.

Now, you can use this key to make API requests to your Standalone server. For each request you make, you'll need to include the `Authorization` header with your API key, like this:

```http
Authorization: Bot YOUR_API_KEY
```

You can see a list of all available API endpoints and their required bodies by going to `http://localhost:3000/swagger`
