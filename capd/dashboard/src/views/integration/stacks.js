export const STACKS = [
  ["node", "Node"],
  ["python", "Python"],
  ["php", "PHP"],
  ["go", "Go"],
  ["ruby", "Ruby"],
  ["dotnet", "C#"],
  ["curl", "cURL"],
];

export const stackCode = (id, verifyUrl) =>
  ({
    node: {
      filename: "server.js",
      language: "js",
      code: `const token = req.body["cap-token"];

const verify = await fetch("${verifyUrl}", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ secret: process.env.CAP_SECRET, response: token }),
});
const { success } = await verify.json();

if (!success) return res.status(403).send("Captcha failed");`,
    },
    python: {
      filename: "server.py",
      language: "python",
      code: `import os
import requests
from flask import abort, request

token = request.form.get("cap-token", "")

res = requests.post(
    "${verifyUrl}",
    json={"secret": os.environ["CAP_SECRET"], "response": token},
    timeout=5,
)

if not res.json().get("success"):
    abort(403)`,
    },
    php: {
      filename: "verify.php",
      language: "php",
      code: `<?php
$ch = curl_init("${verifyUrl}");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
    CURLOPT_POSTFIELDS => json_encode([
        "secret" => getenv("CAP_SECRET"),
        "response" => $_POST["cap-token"] ?? "",
    ]),
]);
$result = json_decode(curl_exec($ch), true);

if (empty($result["success"])) {
    http_response_code(403);
    exit;
}`,
    },
    go: {
      filename: "verify.go",
      language: "go",
      code: `func verifyCap(token string) bool {
	body, _ := json.Marshal(map[string]string{
		"secret":   os.Getenv("CAP_SECRET"),
		"response": token,
	})
	res, err := http.Post("${verifyUrl}", "application/json", bytes.NewReader(body))
	if err != nil {
		return false
	}
	defer res.Body.Close()

	var out struct{ Success bool \`json:"success"\` }
	json.NewDecoder(res.Body).Decode(&out)
	return out.Success
}`,
    },
    ruby: {
      filename: "verify.rb",
      language: "ruby",
      code: `require "net/http"
require "json"

res = Net::HTTP.post(
  URI("${verifyUrl}"),
  { secret: ENV["CAP_SECRET"], response: params["cap-token"] }.to_json,
  "Content-Type" => "application/json",
)

head :forbidden unless JSON.parse(res.body)["success"]`,
    },
    dotnet: {
      filename: "Verify.cs",
      language: "csharp",
      code: `using System.Net.Http.Json;
using System.Text.Json;

using var http = new HttpClient();
var res = await http.PostAsJsonAsync("${verifyUrl}", new {
    secret = Environment.GetEnvironmentVariable("CAP_SECRET"),
    response = Request.Form["cap-token"].ToString(),
});
var result = await res.Content.ReadFromJsonAsync<JsonElement>();

if (!result.GetProperty("success").GetBoolean()) return Forbid();`,
    },
    curl: {
      filename: "Terminal",
      language: "sh",
      code: `curl -X POST "${verifyUrl}" \\
  -H "content-type: application/json" \\
  -d "{\\"secret\\": \\"$CAP_SECRET\\", \\"response\\": \\"$TOKEN\\"}"`,
    },
  })[id];
