# !/bin/bash
sudo rm -R /usr/bin/file-server /usr/bin/fileserver_src
sudo mkdir -p /usr/bin/fileserver_src/

python3 build.py

python3 -m pip install requests flask --break-system-packages

sudo cp -R server.py /usr/bin/fileserver_src/
sudo cp -R index.template /usr/bin/fileserver_src/
sudo cp -R landing.template /usr/bin/fileserver_src/

sudo tee /usr/bin/fileserver_src/fileserver.sh <<EOF
# !/bin/bash
python3 /usr/bin/fileserver_src/server.py "\$@"
EOF

sudo chmod -R 777 /usr/bin/fileserver_src/
sudo ln -s /usr/bin/fileserver_src/fileserver.sh /usr/bin/file-server
sudo chmod 777 /usr/bin/file-server