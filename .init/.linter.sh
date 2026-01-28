#!/bin/bash
cd /home/kavia/workspace/code-generation/contact-manager-pro-206380/contact_manager_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

