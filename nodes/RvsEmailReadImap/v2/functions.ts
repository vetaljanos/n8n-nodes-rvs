import {
	IBinaryData,
	IBinaryKeyData,
	IDataObject,
	INodeExecutionData,
	NodeOperationError
} from "n8n-workflow";
import {connect as imapConnect, getParts, ImapSimple, ImapSimpleOptions, Message} from "imap-simple";
import rfc2047 from "rfc2047";
import {BinaryHelperFunctions, IExecuteFunctions} from "n8n-workflow/dist/Interfaces";
import {simpleParser, Source as ParserSource} from "mailparser";
import _ from "lodash";
import {isCredentialsDataImap} from 'n8n-nodes-base/dist/credentials/Imap.credentials';

// Returns the email text
export const getText = async (connection: ImapSimple, parts: IDataObject[], message: Message, subtype: string) => {
	if (!message.attributes.struct) {
		return '';
	}

	const textParts = parts.filter((part) => {
		return (
			(part.type as string).toUpperCase() === 'TEXT' &&
			(part.subtype as string).toUpperCase() === subtype.toUpperCase()
		);
	});

	if (textParts.length === 0) {
		return '';
	}

	try {
		return (await connection.getPartData(message, textParts[0])) as string;
	} catch {
		return '';
	}
};

// Returns the email attachments
export const getAttachment = async (helpers: BinaryHelperFunctions,
																		imapConnection: ImapSimple,
																		parts: IDataObject[],
																		message: Message,
): Promise<IBinaryData[]> => {
	if (!message.attributes.struct) {
		return [];
	}

	// Check if the message has attachments and if so get them
	const attachmentParts = parts.filter((part) => {
		return (
			part.disposition &&
			((part.disposition as IDataObject)?.type as string).toUpperCase() === 'ATTACHMENT'
		);
	});

	const decodeFilename = (filename: string) => {
		const regex = /=\?([\w-]+)\?Q\?.*\?=/i;
		if (regex.test(filename)) {
			return rfc2047.decode(filename);
		}
		return filename;
	};

	const attachmentPromises = [];
	let attachmentPromise;
	for (const attachmentPart of attachmentParts) {
		attachmentPromise = imapConnection
			.getPartData(message, attachmentPart)
			.then(async (partData) => {
				// if filename contains utf-8 encoded characters, decode it
				const fileName = decodeFilename(
					((attachmentPart.disposition as IDataObject)?.params as IDataObject)
						?.filename as string,
				);
				// Return it in the format n8n expects
				return helpers.prepareBinaryData(partData as Buffer, fileName);
			});

		attachmentPromises.push(attachmentPromise);
	}

	return Promise.all(attachmentPromises);
};

export async function parseRawEmail(
	this: IExecuteFunctions,
	messageEncoded: ParserSource,
	dataPropertyNameDownload: string,
): Promise<INodeExecutionData> {
	const responseData = await simpleParser(messageEncoded);
	const headers: IDataObject = {};
	const additionalData: IDataObject = {};

	for (const header of responseData.headerLines) {
		headers[header.key] = header.line;
	}

	additionalData.headers = headers;
	additionalData.headerLines = undefined;

	const binaryData: IBinaryKeyData = {};
	if (responseData.attachments) {
		for (let i = 0; i < responseData.attachments.length; i++) {
			const attachment = responseData.attachments[i];
			binaryData[`${dataPropertyNameDownload}${i}`] = await this.helpers.prepareBinaryData(
				attachment.content,
				attachment.filename,
				attachment.contentType,
			);
		}

		additionalData.attachments = undefined;
	}

	return {
		json: {...responseData, ...additionalData},
		binary: Object.keys(binaryData).length ? binaryData : undefined,
	} as INodeExecutionData;
}

export async function getNewEmails(this: IExecuteFunctions,
																	 imapConnection: ImapSimple,
																	 searchCriteria: Array<string | string[]>, index: number): Promise<INodeExecutionData[]> {

	const {outLastMessageUID, messageLimit} =
		this.getNodeParameter('options', 0, {
			messageLimit: -1,
			outLastMessageUID: false,
		}) as IDataObject;


	const postProcessAction = this.getNodeParameter('postProcessAction', index) as string;

	const format = this.getNodeParameter('format', index) as string;

	let fetchOptions = {};

	if (format === 'simple' || format === 'raw') {
		fetchOptions = {
			bodies: ['TEXT', 'HEADER'],
			markSeen: false,
			struct: true,
		};
	} else if (format === 'resolved') {
		fetchOptions = {
			bodies: [''],
			markSeen: false,
			struct: true,
		};
	}

	let results;
	try {
		results = await imapConnection.search(searchCriteria, fetchOptions);
	} catch (e) {
		throw new NodeOperationError(
			this.getNode(),
			`Can't perform search operation for item ${index} and search criteria ${searchCriteria}. Source: ${e}`,
			{itemIndex: index},
		);
	}

	const newEmails: INodeExecutionData[] = [];
	let newEmail: INodeExecutionData, messageHeader, messageBody;
	let attachments: IBinaryData[];
	let propertyName: string;

	// All properties get by default moved to metadata except the ones
	// which are defined here which get set on the top level.
	const topLevelProperties = ['cc', 'date', 'from', 'subject', 'to'];

	if (format === 'resolved') {
		const dataPropertyAttachmentsPrefixName = this.getNodeParameter(
			'dataPropertyAttachmentsPrefixName', index
		) as string;

		for (const message of results) {
			if (messageLimit && messageLimit !== -1 && newEmails.length >= messageLimit) {
				break;
			}
			const part = _.find(message.parts, {which: ''});

			if (part === undefined) {
				throw new NodeOperationError(this.getNode(), 'Email part could not be parsed.');
			}
			const parsedEmail = await parseRawEmail.call(
				this,
				part.body as Buffer,
				dataPropertyAttachmentsPrefixName,
			);

			if (outLastMessageUID) {
				parsedEmail.json.uid = message.attributes.uid;
			}

			newEmails.push(parsedEmail);
		}
	} else if (format === 'simple') {
		const downloadAttachments = this.getNodeParameter('downloadAttachments', index) as boolean;

		let dataPropertyAttachmentsPrefixName = '';
		if (downloadAttachments) {
			dataPropertyAttachmentsPrefixName = this.getNodeParameter(
				'dataPropertyAttachmentsPrefixName', index
			) as string;
		}

		for (const message of results) {
			if (messageLimit && messageLimit !== -1 && newEmails.length >= messageLimit) {
				break;
			}
			const parts = getParts(message.attributes.struct as IDataObject[]) as IDataObject[];

			newEmail = {
				json: {
					textHtml: await getText(imapConnection, parts, message, 'html'),
					textPlain: await getText(imapConnection, parts, message, 'plain'),
					metadata: {} as IDataObject,
				},
				pairedItem: {
					item: index
				},
			};

			if (outLastMessageUID) {
				newEmail.json.uid = message.attributes.uid;
			}

			messageHeader = message.parts.filter((part) => {
				return part.which === 'HEADER';
			});

			messageBody = messageHeader[0].body as IDataObject;
			for (propertyName of Object.keys(messageBody)) {
				if ((messageBody[propertyName] as IDataObject[]).length) {
					if (topLevelProperties.includes(propertyName)) {
						newEmail.json[propertyName] = (messageBody[propertyName] as string[])[0];
					} else {
						(newEmail.json.metadata as IDataObject)[propertyName] = (
							messageBody[propertyName] as string[]
						)[0];
					}
				}
			}

			if (downloadAttachments) {
				// Get attachments and add them if any get found
				attachments = await getAttachment(this.helpers, imapConnection, parts, message);
				if (attachments.length) {
					newEmail.binary = {};
					for (let i = 0; i < attachments.length; i++) {
						newEmail.binary[`${dataPropertyAttachmentsPrefixName}${i}`] = attachments[i];
					}
				}
			}

			newEmails.push(newEmail);
		}
	} else if (format === 'raw') {
		for (const message of results) {
			if (messageLimit && messageLimit !== -1 && newEmails.length >= messageLimit) {
				break;
			}
			const part = _.find(message.parts, {which: 'TEXT'});

			if (part === undefined) {
				throw new NodeOperationError(this.getNode(), 'Email part could not be parsed.');
			}
			// Return base64 string
			newEmail = {
				json: {
					raw: part.body as string,
				},
				pairedItem: {
					item: index
				},
			};

			if (outLastMessageUID) {
				newEmail.json.uid = message.attributes.uid;
			}

			newEmails.push(newEmail);
		}
	}

	// only mark messages as seen once processing has finished
	if (postProcessAction === 'read') {
		const uidList = results.map((e) => e.attributes.uid);
		if (uidList.length > 0) {
			await imapConnection.addFlags(uidList, '\\SEEN');
		}
	}

	return newEmails;
}

export async function establishConnection(
	this: IExecuteFunctions,
	index: number
): Promise<ImapSimple> {
	const credentialsObject = await this.getCredentials('imap', index);
	const credentials = isCredentialsDataImap(credentialsObject) ? credentialsObject : undefined;
	if (!credentials) {
		throw new NodeOperationError(this.getNode(), 'Credentials are not valid for imap node.');
	}

	const config: ImapSimpleOptions = {
		imap: {
			user: credentials.user as string,
			password: credentials.password as string,
			host: (credentials.host as string).trim(),
			port: credentials.port as number,
			tls: credentials.secure as boolean,
			authTimeout: 20000,
		},
	};

	const tlsOptions: IDataObject = {};

	if (credentials.allowUnauthorizedCerts) {
		tlsOptions.rejectUnauthorized = false;
	}

	if (credentials.secure) {
		tlsOptions.servername = (credentials.host as string).trim();
	}

	if (!_.isEmpty(tlsOptions)) {
		config.imap.tlsOptions = tlsOptions;
	}

	// Connect to the IMAP server and open the mailbox
	// that we get informed whenever a new email arrives
	try {
		return await imapConnect(config);
	} catch (e) {
		const error = `Connection issue for user ${credentials.user} and server ${credentials.host}. Source: ${e}`;

		throw new NodeOperationError(
			this.getNode(),
			error,
			{itemIndex: index},
		);
	}
}
