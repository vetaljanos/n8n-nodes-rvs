/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from 'n8n-workflow';
import {NodeOperationError} from 'n8n-workflow';

import type {ImapSimple, ImapSimpleOptions} from 'imap-simple';
import {connect as imapConnect} from 'imap-simple';
import _ from 'lodash';

import type {ICredentialsDataImap} from 'n8n-nodes-base/dist/credentials/Imap.credentials';
import {isCredentialsDataImap} from 'n8n-nodes-base/dist/credentials/Imap.credentials';
import {IExecuteFunctions, NodeExecutionWithMetadata} from "n8n-workflow/dist/Interfaces";
import {establishConnection, getNewEmails} from "./functions";


const versionDescription: INodeTypeDescription = {
	displayName: 'RVS Imap loader',
	name: 'emailReadImap',
	icon: 'fa:inbox',
	group: ['output'],
	version: 2,
	description: 'Reads IMAP',
	eventTriggerDescription: 'Reading for you an email',
	defaults: {
		name: 'RVS Email (IMAP)',
		color: '#44AA22',
	},
	// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
	inputs: ['main'],
	outputs: ['main'],
	credentials: [
		{
			name: 'imap',
			required: true,
			testedBy: 'imapConnectionTest',
		},
	],
	properties: [
		{
			displayName: 'Mailbox Name',
			name: 'mailbox',
			type: 'string',
			default: 'INBOX',
		},
		{
			displayName: 'Action',
			name: 'postProcessAction',
			type: 'options',
			options: [
				{
					name: 'Mark as Read',
					value: 'read',
				},
				{
					name: 'Nothing',
					value: 'nothing',
				},
			],
			default: 'read',
			description:
				'What to do after the email has been received. If "nothing" gets selected it will be processed multiple times.',
		},
		{
			displayName: 'Download Attachments',
			name: 'downloadAttachments',
			type: 'boolean',
			default: false,
			displayOptions: {
				show: {
					format: ['simple'],
				},
			},
			description:
				'Whether attachments of emails should be downloaded. Only set if needed as it increases processing.',
		},
		{
			displayName: 'Format',
			name: 'format',
			type: 'options',
			options: [
				{
					name: 'RAW',
					value: 'raw',
					description:
						'Returns the full email message data with body content in the raw field as a base64url encoded string; the payload field is not used',
				},
				{
					name: 'Resolved',
					value: 'resolved',
					description:
						'Returns the full email with all data resolved and attachments saved as binary data',
				},
				{
					name: 'Simple',
					value: 'simple',
					description:
						'Returns the full email; do not use if you wish to gather inline attachments',
				},
			],
			default: 'simple',
			description: 'The format to return the message in',
		},
		{
			displayName: 'Property Prefix Name',
			name: 'dataPropertyAttachmentsPrefixName',
			type: 'string',
			default: 'attachment_',
			displayOptions: {
				show: {
					format: ['resolved'],
				},
			},
			description:
				'Prefix for name of the binary property to which to write the attachments. An index starting with 0 will be added. So if name is "attachment_" the first attachment is saved to "attachment_0"',
		},
		{
			displayName: 'Property Prefix Name',
			name: 'dataPropertyAttachmentsPrefixName',
			type: 'string',
			default: 'attachment_',
			displayOptions: {
				show: {
					format: ['simple'],
					downloadAttachments: [true],
				},
			},
			description:
				'Prefix for name of the binary property to which to write the attachments. An index starting with 0 will be added. So if name is "attachment_" the first attachment is saved to "attachment_0"',
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			options: [
				{
					displayName: 'Custom Email Rules',
					name: 'customEmailConfig',
					type: 'string',
					default: '["UNSEEN"]',
					description:
						'Custom email fetching rules. See <a href="https://github.com/mscdex/node-imap">node-imap</a>\'s search function for more details.',
				},
				{
					displayName: 'Output Message UID',
					name: 'outLastMessageUID',
					type: 'boolean',
					default: false,
					// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
					description: 'Add to output message UID. To use it in next searches just add ["UID", lastMessageUid].',
				},
				{
					displayName: 'Message Limit',
					name: 'messageLimit',
					type: 'number',
					default: -1,
					// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
					description: 'Limit for emails. -1 is unlimited.',
				},
			],
		},
	],
};

export class EmailReadImapV2 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			...versionDescription,
		};
	}

	methods = {
		credentialTest: {
			async imapConnectionTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				if (isCredentialsDataImap(credential.data)) {
					const credentials = credential.data as ICredentialsDataImap;
					try {
						const config: ImapSimpleOptions = {
							imap: {
								user: credentials.user,
								password: credentials.password,
								host: credentials.host.trim(),
								port: credentials.port,
								tls: credentials.secure,
								authTimeout: 20000,
							},
						};
						const tlsOptions: IDataObject = {};

						if (credentials.allowUnauthorizedCerts) {
							tlsOptions.rejectUnauthorized = false;
						}

						if (credentials.secure) {
							tlsOptions.servername = credentials.host.trim();
						}
						if (!_.isEmpty(tlsOptions)) {
							config.imap.tlsOptions = tlsOptions;
						}
						const connection = await imapConnect(config);
						await connection.getBoxes();
						connection.end();
					} catch (error) {
						return {
							status: 'Error',
							message: (error as Error).message,
						};
					}
					return {
						status: 'OK',
						message: 'Connection successful!',
					};
				} else {
					return {
						status: 'Error',
						message: 'Credentials are no IMAP credentials.',
					};
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][] | NodeExecutionWithMetadata[][] | null> {

		const staticData = this.getWorkflowStaticData('node');
		this.logger.debug('Loaded static data for node "EmailReadImap"', { staticData });

		// Returns all the new unseen messages
		const inputs = this.getInputData();

		const all_results = await Promise.all(inputs.map(async (input, index) => {
			const connection: ImapSimple = await establishConnection.call(this, index);

			let mailbox = this.getNodeParameter('mailbox', 0) as string;
			await connection.openBox(mailbox);

			try {
				const options = this.getNodeParameter('options', 0, {}) as IDataObject;
				let searchCriteria = ['UNSEEN'] as Array<string | string[]>;

				if (options.customEmailConfig !== undefined) {
					try {
						searchCriteria = JSON.parse(options.customEmailConfig as string) as Array<
							string | string[]
						>;
					} catch (error) {
						throw new NodeOperationError(this.getNode(), 'Custom email config is not valid JSON.');
					}
				}

				return await getNewEmails.call(this, connection, searchCriteria, index);
			} finally {
				connection.end();
			}
		}));

		return [_.flatten(all_results)];
	}
}
