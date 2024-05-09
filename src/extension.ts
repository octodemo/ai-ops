import * as dotenv from 'dotenv';
import * as fs from 'fs';
import OpenAI from 'openai';
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
	
	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<AIOpsChatResult> => {

		if (request.command == 'scan') {
			console.log('Running SAST Scan');
			stream.progress('Kicking off your SAST scan on branch X...');
			//kickoff SAST scan.
			// Return status of workflow
			// update window when complete..
			return { metadata: { command: 'scan' } };
		} else if (request.command == 'status') {
			console.log('Getting status of workflow');



			stream.progress('Getting status of workflow...');
			// Return status of workflow
			return { metadata: { command: 'status' } };
		} else if (request.command == 'deploy') {
			console.log('Deploying branch');
			stream.progress('Deploying branch...');
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
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.jpeg');
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
