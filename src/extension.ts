import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { Octokit } from "@octokit/rest";
import * as path from 'path';
import * as vscode from 'vscode';
// Load environment variables from .env file
dotenv.config();

const PARTICIPANT_ID = 'ai-ops';

interface AIOpsChatResult extends vscode.ChatResult {
	metadata: {
		command: string;
	};
}

const LANGUAGE_MODEL_ID = 'copilot-gpt-3.5-turbo';

export function activate(context: vscode.ExtensionContext) {

	//for status button to open browser.
	context.subscriptions.push(vscode.commands.registerCommand('extension.openUrl', async (url: string) => {
		vscode.env.openExternal(vscode.Uri.parse(url));
	}));

	
	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<AIOpsChatResult> => {

		const envs = vscode.workspace.getConfiguration('environments');
		const GHAPIKey = envs.get('token') as string ?? '';
		const octokit = new Octokit({
			auth: GHAPIKey,
		  });
		const GHRepo = envs.get('repo') as string ?? '';
		const GHOrg = envs.get('org') as string ?? '';

		if (request.command == 'scan') {
			console.log('Running SAST Scan');
			console.log("STREAM", stream);
			stream.progress('Kicking off your SAST scan on branch X...');
			//kickoff SAST scan.
			// Return status of workflow
			// update window when complete..
			return { metadata: { command: 'scan' } };
		} else if (request.command == 'status') {
			console.log('Getting status of workflow');
			stream.progress('Getting status of workflow...');
						
			const parts = request.prompt.split(' ');
			const workflowFileName = parts[0];

			async function getWorkflowStatus() {
			try {
				const { data } = await octokit.actions.listWorkflowRunsForRepo({
				owner: GHOrg,
				repo: GHRepo,
				workflow_id: "deploy-azure.yml" // hard coded value for easy demo.
				});

				stream.progress('Status of ' + workflowFileName + ' retrieved...');

				// if data.workflow_runs[0].conclusion is null, then set it to equal 'In Progress'
				if (data.workflow_runs[0].conclusion === null) {
					data.workflow_runs[0].conclusion = 'In Progress';
				}

				const status = `**${data.workflow_runs[0].display_title}**\n\nStatus - _${data.workflow_runs[0].conclusion}_`;
				console.log(status);
				//conclusion
				// Set a 3-second timeout before pushing status to chat
				await new Promise(resolve => setTimeout(resolve, 3000));

				//push status to chat;
				stream.markdown(status);
				// stream button that directs to workflow run

				const command: vscode.Command = {
					command: 'extension.openUrl',
					title: 'View Workflow Run',
					arguments: [data.workflow_runs[0].html_url]
				  };
			
				stream.button(command);

				return { metadata: { command: 'status' } };
			} catch (err) {
				console.error(err);
			}
			}

			// Await the getWorkflowStatus function
			await getWorkflowStatus();

			return { metadata: { command: 'status' } };
		} else if (request.command == 'deploy') {
			console.log('Deploying branch');
			stream.progress('Deploying branch...');

			const parts = request.prompt.split(' ');
			const branchName = parts[0];
			//@ai-ops /deploy azure-deploy ai-ops-development
			// remove /n if it exists on parts[1]
			if (parts[1].includes('\n')) {
				parts[1] = parts[1].replace('\n', '');
			}
			const environment = parts[1];

			const { data } = await octokit.actions.createWorkflowDispatch({
				owner: 'octodemo',
				repo: 'universe-recap',
				workflow_id: 'deploy-azure.yml',
				ref: branchName,
				inputs: {
					environment: environment, // if unauthorized check SCM basic auth config in Azure slot settings.
					branch: branchName
				}
			});


			// Return status of workflow
			return { metadata: { command: 'deploy' } };
		} else if (request.command == 'orderFreePizzaToDesk') {
			console.log('Ordering free pizza to desk');
			stream.progress('Nice try...');
			// Return status of workflow
			return { metadata: { command: 'orderFreePizzaToDesk' } };
		}
		else {
			const messages = [
				new vscode.LanguageModelChatSystemMessage(
					'Your AIOps assistant can Deploy a branch, Get the status of a workflow or perform a SAST Scan! '
				),
				new vscode.LanguageModelChatUserMessage(request.prompt),
			];
			const chatResponse = await vscode.lm.sendChatRequest(
				LANGUAGE_MODEL_ID,
				messages,
				{},
				token
			);
			for await (const fragment of chatResponse.stream) {
				// Process the output from the language model
				
				stream.markdown(fragment);
			}

			return { metadata: { command: '' } };
		}
	};

	// Chat participants appear as top-level options in the chat input
	// when you type `@`, and can contribute sub-commands in the chat input
	// that appear when you type `/`.
	const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'logo.jpeg');
	participant.followupProvider = {
		provideFollowups(
			result: AIOpsChatResult,
			context: vscode.ChatContext,
			token: vscode.CancellationToken
		) {
			return [
				{
					prompt: 'Use AIOps to perform operations on your workspace.',
					label: vscode.l10n.t('Deploy, Status, Scan'),
					command: 'explain',
				} satisfies vscode.ChatFollowup,
			];
		},
	};
}

export function deactivate() {}
