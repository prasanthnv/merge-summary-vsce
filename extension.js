const vscode = require('vscode');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Executes a Git command safely in the workspace directory.
 * @param {string} command The Git command to execute.
 * @returns {string|null} The command output or null if an error occurs.
 */
function runGitCommand(command) {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a project.');
            return null;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        return execSync(command, { cwd: workspacePath }).toString().trim();
    } catch (error) {
        return null;
    }
}

/**
 * Checks if the current directory is inside a Git repository.
 * @returns {boolean} True if inside a Git repo, false otherwise.
 */
function isGitRepo() {
    return runGitCommand('git rev-parse --is-inside-work-tree') === 'true';
}

/**
 * Generates a merge request summary from Git commit history.
 * @returns {string} Merge summary in Markdown format or an error message.
 */
function mrSummary() {
    if (!isGitRepo()) {
        vscode.window.showErrorMessage('Not a Git repository. Please open a project with Git initialized.');
        return 'Error: Not a Git repository.';
    }

    // Get the current branch name
    const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');
    if (!currentBranch) {
        vscode.window.showErrorMessage('Failed to determine the current Git branch.');
        return 'Error: Could not determine the branch.';
    }

    // Determine the base branch (main or master)
    let baseBranch = runGitCommand('git show-ref --verify --quiet refs/heads/main') ? 'main' :
                     runGitCommand('git show-ref --verify --quiet refs/heads/master') ? 'master' :
                     runGitCommand('git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null')
                        ?.replace(/^refs\/remotes\/origin\//, '') || '';

    if (!baseBranch) {
        vscode.window.showErrorMessage('Could not determine the default branch (main/master).');
        return 'Error: Could not determine the base branch.';
    }

    // Fetch latest changes
    vscode.window.showInformationMessage('Fetching latest changes...');
    runGitCommand('git fetch');

    // Get commit history
    const commitLog = runGitCommand(`git log ${baseBranch}..${currentBranch} --pretty=format:"%h|%s"`);
    if (!commitLog) {
        vscode.window.showWarningMessage('No new commits found for the merge request.');
        return 'No new commits found.';
    }

    // Build the summary
    let output = '### Summary\n\n### Changes:\n';
    commitLog.split('\n').forEach(commit => {
        const [commitHash, commitMessage] = commit.split('|');
        output += `- ${commitMessage}\n`;
    });

    return output;
}

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = 'MR Summary';
    statusBarItem.command = 'mergeSummary.showSummary';
    statusBarItem.show();

    let disposable = vscode.commands.registerCommand('mergeSummary.showSummary', function () {
        let summary = mrSummary();

        // Create a Webview Panel
        const panel = vscode.window.createWebviewPanel(
            'mergeSummaryPanel',
            'Merge Summary',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        // Set the Webview content
        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Merge Summary</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 10px; }
                    h2 { color: #007acc; }
                    textarea {
                        width: 100%;
                        height: 300px;
                        font-size: 14px;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                        padding: 10px;
                    }
                    button {
                        margin-top: 10px;
                        padding: 5px 10px;
                        font-size: 14px;
                        background-color: #007acc;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    button:hover {
                        background-color: #005f99;
                    }
                </style>
            </head>
            <body>
                <h2>Merge Request Summary</h2>
                <textarea id="summaryText" readonly>${summary}</textarea>
                <div>
                    <button id="copyButton">Copy to Clipboard</button>
                </div>
                <script>
                    document.getElementById('copyButton').addEventListener('click', function() {
                        const text = document.getElementById('summaryText').value;
                        navigator.clipboard.writeText(text).then(() => {
                            alert('Summary copied to clipboard!');
                        }).catch(err => {
                            alert('Failed to copy: ' + err);
                        });
                    });
                </script>
            </body>
            </html>
        `;
    });

    context.subscriptions.push(disposable, statusBarItem);
}

function deactivate() {}

module.exports = { activate, deactivate };
