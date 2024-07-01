import os
import shutil


SCRIPT_NAME = "FootballScores.js"
DESTINATION_PATH = "{HOME_DIR}/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents"


def main():
    print(f"Deploying {SCRIPT_NAME} to {DESTINATION_PATH}")
    deploy_script(SCRIPT_NAME, DESTINATION_PATH)


def deploy_script(script_name, destination_path):
    
    # Set the user's home directory in the destination path
    home_dir = os.path.expanduser("~")
    destination_path = destination_path.replace("{HOME_DIR}", home_dir)
    
    # Copy the script to the destination path
    shutil.copy(script_name, destination_path)
    
    print("Deployment complete")
    

if __name__ == "__main__":
    main()