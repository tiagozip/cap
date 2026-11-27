export const LANGS = [
  ["node", "Node.js"],
  ["python", "Python"],
  ["php", "PHP"],
  ["go", "Go"],
];

export const verifySnippet = (lang, origin) => {
  const url = `${origin}/siteverify`;
  return {
    node: {
      filename: "server.js",
      language: "js",
      code: `const token = req.body["cap-token"];
const res = await fetch("${url}", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ secret: process.env.CAP_SECRET, response: token }),
});
const { success } = await res.json();`,
    },
    python: {
      filename: "server.py",
      language: "py",
      code: `import os, requests

token = request.form["cap-token"]
res = requests.post("${url}", json={
    "secret": os.environ["CAP_SECRET"],
    "response": token,
})
success = res.json()["success"]`,
    },
    php: {
      filename: "server.php",
      language: "php",
      code: `$token = $_POST["cap-token"];
$res = file_get_contents("${url}", false, stream_context_create([
    "http" => [
        "method" => "POST",
        "header" => "content-type: application/json",
        "content" => json_encode([
            "secret" => getenv("CAP_SECRET"),
            "response" => $token,
        ]),
    ],
]));
$success = json_decode($res, true)["success"];`,
    },
    go: {
      filename: "server.go",
      language: "go",
      code: `token := r.FormValue("cap-token")
body, _ := json.Marshal(map[string]string{
    "secret":   os.Getenv("CAP_SECRET"),
    "response": token,
})
res, err := http.Post("${url}", "application/json", bytes.NewReader(body))
if err != nil {
    return err
}
defer res.Body.Close()
var out struct{ Success bool \`json:"success"\` }
json.NewDecoder(res.Body).Decode(&out)
success := out.Success`,
    },
  }[lang];
};
