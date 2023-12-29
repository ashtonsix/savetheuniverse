# Save The Universe Simulation Server

Assuming Ubuntu & availability of Nvidia GPU, install system dependencies:

```sh
sudo apt update
sudo apt upgrade -y
sudo apt install nvidia-cuda-toolkit -y
sudo apt install libjpeg-turbo8-dev -y
sudo apt install build-essential -y
sudo apt install python3.11-venv -y
```

Install project dependencies:

```sh
cd savetheuniverse-server
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
```

Build and run:

```sh
make
python3 source/http_server.py
```

Navigate to http://localhost:8080/video
