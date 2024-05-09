import * as dotenv from 'dotenv';
import * as fs from 'fs';
import OpenAI from 'openai';
import * as path from 'path';
import * as vscode from 'vscode';
// Load environment variables from .env file
dotenv.config();

const PARTICIPANT_ID = 'i2c';

interface I2ChatResult extends vscode.ChatResult {
	metadata: {
		command: string;
	};
}

const LANGUAGE_MODEL_ID = 'copilot-gpt-3.5-turbo'; // Use faster model. Alternative is 'copilot-gpt-4', which is slower but more powerful

export function activate(context: vscode.ExtensionContext) {
	
	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<I2ChatResult> => {

		if (request.command == 'convertFile') {
			console.log('Converting the file to code');

			const config = vscode.workspace.getConfiguration('openai');
			const openAIAPIKey = config.get('openAIAPIKey') as string ?? '';
			const openai = new OpenAI({
				apiKey: "openAIAPIKey",
			});


			stream.progress('Converting your design image to code! Be right back...');
			let language: string | undefined;

			const parts = request.prompt.split(' ');
			const filePath = parts[0];
			
			if (parts[1]) {
				language = parts[1];
			} else if (vscode.window.activeTextEditor) {
				language = vscode.window.activeTextEditor.document.languageId;
			} else if (vscode.workspace.textDocuments.length > 0){
				language = vscode.workspace.textDocuments[0].languageId;
			} else {
				language = 'HTML, CSS, JS. Ask user to specify the language they want to convert the image to.';
			}

			const workspaceRoot = vscode.workspace.workspaceFolders
				? vscode.workspace.workspaceFolders[0].uri.fsPath
				: '';
			const fullPath = path.join(workspaceRoot, filePath);
			// Read the file contents as a buffer
			const fileBuffer = fs.readFileSync(fullPath);

			// Encode file to base64
			const fileBase64 = fileBuffer.toString('base64');
			const response = await openai.chat.completions.create({
				model: 'gpt-4-vision-preview',
				stream: true,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'text',
								text: 'Give me code to succinctly implement this image in ' + language,
							},
							{
								type: 'image_url',
								image_url: {
									url: 'data:image/jpeg;base64,' + fileBase64,
								},
							},
						],
					},
				],
			});
			let codeResp = '';
			for await (const chunk of response) {
				codeResp += chunk.choices[0]?.delta?.content || '';
				stream.markdown(chunk.choices[0]?.delta?.content || '');
			}

			return { metadata: { command: 'convertFile' } };
		} else {
			const messages = [
				new vscode.LanguageModelChatSystemMessage(
					'You are i2c Developer! You convert any image to code. Just provide the image path and I will convert it to code for you.'
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
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'deere.jpeg');
	participant.followupProvider = {
		provideFollowups(
			result: I2ChatResult,
			context: vscode.ChatContext,
			token: vscode.CancellationToken
		) {
			return [
				{
					prompt: 'Convert an image to code',
					label: vscode.l10n.t('How convert image to code'),
					command: 'explain',
				} satisfies vscode.ChatFollowup,
			];
		},
	};
}

export function deactivate() {}
