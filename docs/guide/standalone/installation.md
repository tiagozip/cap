# Installation

### Requirements

You'll need to have [Docker Engine 20.10 or higher](https://docs.docker.com/get-docker/) installed on your server. Both `x86_64` (amd64) and `arm64` architectures are supported.

---

Run the following command to pull the Cap Standalone Docker image from Docker Hub:

```bash
docker pull tiago2/cap:latest
```

Then, to run the server, use the following command:

```bash
docker run -d \
  -p 3000:3000 \
  -v cap-data:/usr/src/app/.data \
  -e ADMIN_KEY=your_secret_password \
  --name cap-standalone \
  tiago2/cap:latest
```

Make sure to replace `your_secret_password` with a strong password, as anyone with it will be able to log into the dashboard and create keys. It'll need to be at least 30 characters long.

Then, you can access the dashboard at `http://localhost:3000`, log in, and create a key. You'll get a site key and a secret key which you'll be able to use on your widget.

On Debian and other OSes that don't use `iptables`, if you can't open the dashboard, try setting `--network=host` in the run command. Thanks to [Boro Vukovic](https://github.com/tiagorangel1/cap/issues/70#issuecomment-3086464282) for letting me know about this.

You'll also need to make the server publicly accessible from the internet, as the widget needs to be able to reach it.

Done! Now, read the [usage guide](/guide/standalone/usage.md) to learn how to use it.
