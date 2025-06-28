from flask import Flask, request, jsonify, send_from_directory
import argparse
import os
import requests
import json

DB_PATH = "./db"
MKG_URL = ""

def list_files_recursive(base_path):
    result = []
    for root, _, files in os.walk(base_path):
        for file in files:
            relative_path = os.path.relpath(os.path.join(root, file), base_path)
            result.append(relative_path.replace(os.sep, '/'))
    return result

def get_template(name):
    return open(os.path.dirname(os.path.abspath(__file__)) + "/" + name + ".template", "r").read()

def create_flask_server():
    app = Flask(__name__)

    @app.route(f"/db/<path:filename>")
    def _serve(filename):        
        return send_from_directory(f"{os.getcwd()}/{DB_PATH}", filename)

    @app.route("/")
    def _root():
        return get_template("landing")
    
    @app.route("/<id>", methods=["GET"])
    def _display(id):
        return get_template("index")
    
    @app.route("/data/<id>", methods=["GET"])
    def _data(id):
        path = f"{DB_PATH}/{id}"
        
        return jsonify(list_files_recursive(path))
    
    @app.route("/remove/<id>/<path:path>", methods=["GET"])
    def _remove(id, path):
        path = f"{DB_PATH}/{id}/{path}"
        if os.path.exists(path):
            os.remove(path)
        path = f"{DB_PATH}/{id}"
        if len(list_files_recursive(path)) == 0:
            os.removedirs(path)
        
        return "", 200

    @app.route("/upload/<id>", methods=["POST"])
    def _upload(id):
        url = request.form.get("url")
        if (not url) and ("file" not in request.files): return "No item part", 400

        path = f"{DB_PATH}/{id}"

        if url:
            try:
                url = url.strip()
                categories = "/".join(url.split("] ")[0].removeprefix("[").split(";"))
                url = url.split("] ")[1]
                content = requests.get(url, headers={ "User-Agent": "Mozilla/5.0" }, stream=True)
                filename = url.split("#")[0].split("?")[0].split("/")[-1]
                path = f"{path}/{categories}/{filename}"
                
                os.makedirs(os.path.dirname(path), exist_ok=True)
                
                with open(path, 'wb') as f:
                    for chunk in content.iter_content(chunk_size=8192):
                        if chunk: f.write(chunk)
            except:
                None
        else:
            file = request.files["file"]
            if file.filename == "": return "No selected file", 400

            path = f"{path}/{file.filename}"
            os.makedirs(os.path.dirname(path), exist_ok=True)
            file.save(path)
        
        return "", 200
    
    @app.route("/mkg/<id>", methods=["POST"])
    def _mkg(id):
        if not request.form.get("items"):
            return jsonify({ "success": False, "error": "No items specified!" }), 400
        
        if not request.form.get("categories"):
            return jsonify({ "success": False, "error": "No categories specified!" }), 400
        
        u = request.form.get("url") if request.form.get("url") else MKG_URL

        if not u:
            return jsonify({ "success": False, "error": "No mkg instance found. Please contact a server admin!" }), 400

        u = u.replace("__self__", f"{request.scheme}://{request.host.split(':')[0]}").removesuffix("/")

        g = [ r["src"] for r in json.loads(requests.get(f"{u}/items/{id}/").content) ]
        lastID = len(g)

        items = [ item for item in json.loads(request.form.get("items")) if item not in g ]
        categories = json.loads(request.form.get("categories"))

        response = requests.post(f"{u}/update/{id}/", files={
            "added": (None, json.dumps(items)),
            "removed": (None, "[]"),
            "categoriesChanged": (None, json.dumps([ [ lastID + i, item ] for i, item in enumerate(categories) if item ]))
        })

        return jsonify({ "url": f"{u}/{id}" }), response.status_code

    return app

def start_flask_server(port = 4420, host = "127.0.0.1"):
    server = create_flask_server()
    server.run(host, port, False)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="File hosting server.")
    parser.add_argument("--port", "-po", type=int, help="Set the port the server should be running on. (Default: 4421)", default=4421)
    parser.add_argument("--host", "-ht", type=str, help="Set the host the server should be running on. (Default: 127.0.0.1)", default="127.0.0.1")
    parser.add_argument("--db-path", "-db", type=str, help="Set the path to the db directory. (Default: ./db)", default="./db")
    parser.add_argument("--mkgallery-host", "-mkg", type=str, help="Set the default url of an MKGallery server instance.")

    args = parser.parse_args()
    MKG_URL = args.mkgallery_host
    DB_PATH = args.db_path

    start_flask_server(args.port, args.host)