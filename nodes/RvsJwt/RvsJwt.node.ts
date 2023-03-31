import {INodeExecutionData, INodeType, INodeTypeDescription} from "n8n-workflow";
import {IExecuteFunctions} from "n8n-core";
import {verify, sign} from 'jsonwebtoken';

export class RvsJwt implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RVS JWT',
		name: 'rvsJwt',
		icon: 'file:jwtio-json-web-token.svg',
		group: ['helpers'],
		version: 1,
		description: 'Simple tool to generate and verify JWT Tokens',
		defaults: {
			name: 'RVS JWT',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Generate JWT',
						value: 'generateJwt',
						description: 'Generate JWT Token',
						action: 'Generate JWT Token',
					},
					{
						name: 'Verify JWT',
						value: 'verifyJwt',
						description: 'Verify Jwt Token',
						action: 'Verify Jwt Token',
					},
				],
				default: 'verifyJwt',
			},

			// ----------------------------------
			//         Generate JWT
			// ----------------------------------
			{
				displayName: 'Payload',
				name: 'payload',
				type: 'string',
				default: '',
				placeholder: 'Object or string',
				required: true,
				description: 'Json data object',
				displayOptions: {
					show: {
						operation: ['generateJwt', 'verifyJwt'],
					},
				},
			},
			{
				displayName: 'Target Object Name',
				name: 'targetObjectName',
				type: 'string',
				default: 'result',
				placeholder: 'result object key',
				required: true,
				description: 'Name of result object',
				displayOptions: {
					show: {
						operation: ['verifyJwt', 'generateJwt'],
					},
				},
			},
			{
				displayName: 'Private Key',
				name: 'privateKey',
				type: 'string',
				default: '',
				placeholder: '',
				description:
					'Private Key to use in sign algorithm',
				displayOptions: {
					show: {
						operation: ['generateJwt', 'verifyJwt'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				displayOptions: {
					show: {
						operation: ['verifyJwt'],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers',
				options: [
					{
						displayName: 'Raise exception',
						name: 'raiseException',
						type: 'boolean',
						default: false,
						description:
							'Raise exception if error or return object',
					},
				],
			}
			],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const privateKey = this.getNodeParameter('privateKey', 0) as string;
		const operation = this.getNodeParameter('operation', 0);
		const targetObjectName = this.getNodeParameter('targetObjectName', 0, 'result') as string;
		const payloadRaw = this.getNodeParameter('payload', 0);

		let result: string|object;

		if (operation === 'generateJwt') {

			if (!payloadRaw) {
				throw 'Payload must be defined in type string or object';
			}

			let payload: string|object;

			if (typeof payloadRaw === 'object' || typeof payloadRaw === 'string') {
				payload = payloadRaw;
			} else {
				payload = JSON.stringify(payloadRaw);
			}

			result = sign(payload, privateKey);
		} else if (operation === 'verifyJwt') {
			try {
				result = Object.assign(verify(payloadRaw as string, privateKey, {
					complete: true
				}), {error: false});

			} catch (e) {
				const options = this.getNodeParameter('options', 0);

				if (options.raiseException) {
					throw e;
				}

				result = {
					error: true
				}
			}
		} else {
			throw 'Unsupported operation';
		}

		let s = sign('123', '12345678');
		console.log(s);
		return this.prepareOutputData([{json: {[targetObjectName]: result}}]);
	}
}
