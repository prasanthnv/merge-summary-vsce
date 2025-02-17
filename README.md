# MR Summary Extension

The MR Summary extension for Visual Studio Code generates a markdown summary of commits in a merge request, making it easier to create detailed summaries for your code changes. It works by fetching commit logs from the current branch and comparing them with the base branch, creating a concise summary that you can use for your merge requests.

## Features

- Fetches commits on the current branch not present in the base branch.
- Formats the commit messages into a markdown list.
- Displays the summary in a Webview panel for easy access.
- Adds a "MR Summary" button to the status bar for quick access to the summary.