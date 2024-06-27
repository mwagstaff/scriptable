import os
import shutil


SCRIPT_NAME = "FootballScores.js"
DESTINATION_PATH = "/users/mwagstaff/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents"


def main():
    print(f"Deploying {SCRIPT_NAME} to {DESTINATION_PATH}")
    deploy_script(SCRIPT_NAME, DESTINATION_PATH)


def deploy_script(script_name, destination_path):
    
    # Copy the script to the destination path
    shutil.copy(script_name, destination_path)
    destination_file = os.path.join(destination_path, script_name)
    
    # Apply all the secrets, iterating over all the files in the .secrets directory
    for secrets_file_name in os.listdir(".secrets"):
        apply_secret(destination_file, secrets_file_name)
    
    print("Deployment complete")
    

# Apply the weather API key before deploying
def apply_secret(destination_file, secrets_file):
    
    # Set the target value to the file name without the .txt extension
    target_value = secrets_file.replace(".txt", "")
    
    print(f"Applying {target_value} secret")
    
    # The secrets file should exist at ./.secrets/{target_value}.txt
    secrets_file = os.path.join(".secrets", target_value + ".txt")
    
    if os.path.exists(secrets_file) and os.path.exists(destination_file):
        
        # Read the contents of the secrets file
        with open(secrets_file, 'r') as file:
            secret_value = file.read()
        
        # Open the destination file in read/write mode
        with open(destination_file, 'r') as file:
            filedata = file.read()

        # Replace the secret placeholder with the actual value,
        # e.g. "const DEVICE_ID = 'DEVICE_ID_SECRET'" -> "const DEVICE_ID = '123456789'"
        filedata = filedata.replace(f"{target_value}_SECRET", secret_value)
        
        # Write the updated file
        with open(destination_file, 'w') as file:
            file.write(filedata)
    else:
        print(f"Unable to apply {target_value} secret to {destination_file}. Please ensure a file exists and is readable at {secrets_file} with the appropriate entry.")
        exit(1)
        

if __name__ == "__main__":
    main()