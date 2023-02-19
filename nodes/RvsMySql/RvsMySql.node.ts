import type {INodeExecutionData,} from 'n8n-workflow';
import {IDataObject} from "n8n-workflow";
// @ts-ignore
import type mysql2 from 'mysql2/promise';

import {createConnection} from '../../n8n/packages/nodes-base/nodes/MySql/GenericFunctions';
import type {IExecuteFunctions} from 'n8n-core';
import {MySql} from "../../n8n/packages/nodes-base/nodes/MySql/MySql.node";

export class RvsMySql extends MySql {
	constructor() {
		super();

		this.description.displayName = 'RVS MySQL';
		this.description.name = 'rvsMySql';
		this.description.defaults.name = 'RVS MySQL';

		this.description.properties.filter(p => p.name === 'operation').forEach(o => {
			o.options?.push({
				name: 'Update Query',
				value: 'updateQuery',
				description: 'Update table using SQL command',
				action: 'Placeholder Query'
			});
		});
		this.description.properties.push({
			displayName: 'Query',
			name: 'query',
			type: 'string',
			displayOptions: {
				show: {
					operation: ['updateQuery'],
				},
			},
			default: '',
			placeholder: '',
			required: true,
			description: 'The SQL query to execute',
		});
		this.description.properties.push({
			displayName: 'Columns',
			name: 'columns',
			type: 'string',
			displayOptions: {
				show: {
					operation: ['updateQuery'],
				},
			},
			default: '',
			placeholder: 'id,name,description',
			description:
				'Comma-separated list of the properties which should used as params for query',
		});

		const superExecute: Function = super.execute;
		const executeMy: Function = this.placeholderQuery;

		this.execute = async function (this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
			const operation = this.getNodeParameter('operation', 0);

			if (operation === 'updateQuery') {
				return executeMy.call(this);
			} else {
				return superExecute.call(this);
			}
		};
	}

	async placeholderQuery(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('mySql');
		const connection = await createConnection(credentials);
		const items = this.getInputData();
		let returnItems: INodeExecutionData[] = [];

		try {
			const query = this.getNodeParameter('query', 0, '', {extractValue: true}) as string;
			const columnString = this.getNodeParameter('columns', 0) as string;
			const columns = columnString.split(',').map((column) => column.trim());

			const queryResults = (await Promise.all(items.map(item => {
				const requestItem = columns.map(column => {
					if (item.json[column] === undefined) {
						return null;
					} else {
						return item.json[column];
					}
				});

				return connection.execute(query, requestItem).then(([result]) => {
					return {
						...item.json,
						result
					}
				});
			}))) as unknown as IDataObject[];

			returnItems = this.helpers.returnJsonArray(queryResults as unknown as IDataObject);
		} catch (error) {
			if (this.continueOnFail()) {
				returnItems = this.helpers.returnJsonArray({error: error.message});
			} else {
				await connection.end();
				throw error;
			}
		}

		await connection.end();

		return this.prepareOutputData(returnItems);
	}
}
