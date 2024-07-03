
Checkout jobman source code, releases, and documentation at: `https://github.com/chaimeleon-eu/jobman`


Usage examples:
```
  jobman images
  jobman image-details -i ubuntu-python:latest
  jobman submit -i ubuntu-python:latest -j j -r no-gpu -- python persistent-home/myScript.py
  jobman submit -i ubuntu-python:latest -j j -r no-gpu -e MY_VAR=/tmp -e ANOTHER_VAR='/opt/my app' -- 'ls -al $MY_VAR && ls -al "$ANOTHER_VAR"'
  jobman list
  jobman logs -j job1
  jobman delete -j job1
  jobman submit -i ubuntu-python:latest-cuda -r small-gpu -- nvidia-smi
```
Type `jobman --help` to see a  list of supported commands and more.