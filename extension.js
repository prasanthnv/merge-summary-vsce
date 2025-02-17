const vscode = require('vscode');
const { execSync } = require('child_process');

/**
 * Generates a merge request summary from Git commit history.
 * @returns {string} Merge summary in Markdown format.
 */
function mrSummary() {
    // Get the current branch name.
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

    // Determine the base branch.
    let baseBranch = '';
    try {
        execSync('git show-ref --verify --quiet refs/heads/main');
        baseBranch = 'main';
    } catch (e) {
        try {
            execSync('git show-ref --verify --quiet refs/heads/master');
            baseBranch = 'master';
        } catch (e) {
            baseBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null')
                .toString()
                .replace(/^refs\/remotes\/origin\//, '')
                .trim();
            if (!baseBranch) {
                console.error('Error: Could not determine the default branch.');
                return;
            }
        }
    }

    // Fetch the latest changes.
    console.log('Fetching latest changes...');
    execSync('git fetch');

    // Retrieve commits on the current branch that are not in the base branch.
    const commits = execSync(`git log ${baseBranch}..${currentBranch} --pretty=format:"%h|%s"`)
        .toString()
        .split('\n')
        .filter(line => !line.includes('Merge branch') && !line.includes('Merge remote'));

    // Build the merge request summary in Markdown format.
    let output = '### Summary\n\n### Changes:\n';

    commits.forEach(commit => {
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
    // Create a status bar item for quick access with name "MR Summary" and add the icon
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = 'MR Summary';
    statusBarItem.command = 'mergeSummary.showSummary';

    // Show the status bar item immediately upon activation
    statusBarItem.show();

    // Register the command to show the merge summary in a webview
    let disposable = vscode.commands.registerCommand('mergeSummary.showSummary', function () {
        let summary = mrSummary();

        // Create a Webview Panel
        const panel = vscode.window.createWebviewPanel(
            'mergeSummaryPanel',
            'Merge Summary',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        // Set the Webview content with a text area and copy button
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
                    // Copy to clipboard button event
                    document.getElementById('copyButton').addEventListener('click', function() {
                        const text = document.getElementById('summaryText').value;
                        navigator.clipboard.writeText(text).then(function() {
                            alert('Summary copied to clipboard!');
                        }).catch(function(err) {
                            alert('Failed to copy to clipboard: ' + err);
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
