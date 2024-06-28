import os
import shutil


SCRIPT_NAME = "TrainTrack.js"
DESTINATION_PATH = "/users/mwagstaff/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents"


def main():
    print(f"Deploying {SCRIPT_NAME} to {DESTINATION_PATH}")
    deploy_script(SCRIPT_NAME, DESTINATION_PATH)


def deploy_script(script_name, destination_path):
    
    # Copy the script to the destination path
    shutil.copy(script_name, destination_path)
        

if __name__ == "__main__":
    main()