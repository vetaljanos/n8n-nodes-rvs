import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { EmailReadImapV2 } from './v2/EmailReadImapV2.node';

export class RvsEmailReadImap extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Email Read Node',
			name: 'rvsEmailReadImap',
			icon: 'fa:inbox',
			group: ['output'],
			description: 'Triggers the workflow when a new email is received',
			defaultVersion: 2,
		};

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			2: new EmailReadImapV2(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
