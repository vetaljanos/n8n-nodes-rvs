import type {
	ICredentialDataDecryptedObject,
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType, INodeTypeDescription,
} from 'n8n-workflow';
import {IDataObject, NodeOperationError} from "n8n-workflow";
import type mysql2 from 'mysql2/promise';

import {createConnection, copyInputItems, searchTables} from 'n8n-nodes-base/dist/nodes/MySql/GenericFunctions';
import type {IExecuteFunctions} from 'n8n-core';

export class RvsMySql implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RVS MySQL',
		name: 'rvsMySql',
		icon: 'file:mysql.svg',
		group: ['input'],
		version: 1,
		description: 'Get, add and update data in MySQL',
		defaults: {
			name: 'RVS MySQL',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'mySql',
				required: true,
				testedBy: 'mysqlConnectionTest',
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Execute Query',
						value: 'executeQuery',
						description: 'Execute an SQL query',
						action: 'Execute a SQL query',
					},
					{
						name: 'Insert',
						value: 'insert',
						description: 'Insert rows in database',
						action: 'Insert rows in database',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update rows in database',
						action: 'Update rows in database',
					},
					{
						name: 'Prepared Statement',
						value: 'preparedStatement',
						description: 'Prepared Statement Execution',
						action: 'Prepared statement'
					}
				],
				default: 'insert',
			},

			// ----------------------------------
			//         preparedStatement
			// ----------------------------------
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['preparedStatement'],
					},
				},
				default: '',
				placeholder: '',
				required: true,
				description: 'The SQL query to execute',
			},
			{
				displayName: 'Columns',
				name: 'columns',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['preparedStatement'],
					},
				},
				default: '',
				placeholder: 'id,name,description',
				description:
					'Comma-separated list of the properties which should used as params for query',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				displayOptions: {
					show: {
						operation: ['preparedStatement'],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers',
				options: [
					{
						displayName: 'Support Big Numbers',
						name: 'supportBigNumbers',
						type: 'boolean',
						default: false,
						description:
							'Whether support big numbers for connection',
					},
				],
			},
			// ----------------------------------
			//         executeQuery
			// ----------------------------------
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['executeQuery'],
					},
				},
				default: '',
				placeholder: 'SELECT id, name FROM product WHERE id < 40',
				required: true,
				description: 'The SQL query to execute',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				displayOptions: {
					show: {
						operation: ['executeQuery'],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers',
				options: [
					{
						displayName: 'Support Big Numbers',
						name: 'supportBigNumbers',
						type: 'boolean',
						default: false,
						description:
							'Whether support big numbers for connection',
					},
				],
			},

			// ----------------------------------
			//         insert
			// ----------------------------------
			{
				displayName: 'Table',
				name: 'table',
				type: 'resourceLocator',
				default: {mode: 'list', value: ''},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Table...',
						typeOptions: {
							searchListMethod: 'searchTables',
							searchFilterRequired: false,
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						placeholder: 'table_name',
					},
				],
				displayOptions: {
					show: {
						operation: ['insert'],
					},
				},
				description: 'Name of the table in which to insert data to',
			},
			{
				displayName: 'Columns',
				name: 'columns',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['insert'],
					},
				},
				requiresDataPath: 'multiple',
				default: '',
				placeholder: 'id,name,description',
				description:
					'Comma-separated list of the properties which should used as columns for the new rows',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				displayOptions: {
					show: {
						operation: ['insert'],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers for INSERT statement',
				options: [
					{
						displayName: 'Ignore',
						name: 'ignore',
						type: 'boolean',
						default: true,
						description:
							'Whether to ignore any ignorable errors that occur while executing the INSERT statement',
					},
					{
						displayName: 'Priority',
						name: 'priority',
						type: 'options',
						options: [
							{
								name: 'Low Prioirity',
								value: 'LOW_PRIORITY',
								description:
									'Delays execution of the INSERT until no other clients are reading from the table',
							},
							{
								name: 'High Priority',
								value: 'HIGH_PRIORITY',
								description:
									'Overrides the effect of the --low-priority-updates option if the server was started with that option. It also causes concurrent inserts not to be used.',
							},
						],
						default: 'LOW_PRIORITY',
						description:
							'Ignore any ignorable errors that occur while executing the INSERT statement',
					},
					{
						displayName: 'Support Big Numbers',
						name: 'supportBigNumbers',
						type: 'boolean',
						default: false,
						description:
							'Whether enable support big numbers for connection',
					},
				],
			},

			// ----------------------------------
			//         update
			// ----------------------------------
			{
				displayName: 'Table',
				name: 'table',
				type: 'resourceLocator',
				default: {mode: 'list', value: ''},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Table...',
						typeOptions: {
							searchListMethod: 'searchTables',
							searchFilterRequired: false,
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						placeholder: 'table_name',
					},
				],
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				description: 'Name of the table in which to update data in',
			},
			{
				displayName: 'Update Key',
				name: 'updateKey',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				default: 'id',
				required: true,
				// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-id
				description:
					'Name of the property which decides which rows in the database should be updated. Normally that would be "id".',
			},
			{
				displayName: 'Columns',
				name: 'columns',
				type: 'string',
				requiresDataPath: 'multiple',
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				default: '',
				placeholder: 'name,description',
				description:
					'Comma-separated list of the properties which should used as columns for rows to update',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers',
				options: [
					{
						displayName: 'Support Big Numbers',
						name: 'supportBigNumbers',
						type: 'boolean',
						default: false,
						description:
							'Whether support big numbers for connection',
					},
				],
			},
		],
	};

	methods = {
		credentialTest: {
			async mysqlConnectionTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials = credential.data as ICredentialDataDecryptedObject;
				try {
					const connection = await createConnection(credentials);
					await connection.end();
				} catch (error) {
					return {
						status: 'Error',
						message: error.message,
					};
				}
				return {
					status: 'OK',
					message: 'Connection successful!',
				};
			},
		},
		listSearch: {
			searchTables,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('mySql');
		const supportBigNumbers = !!this.getNodeParameter('options', 0)?.supportBigNumbers;
		const connection = await createConnection({...credentials, supportBigNumbers, bigNumberStrings: supportBigNumbers});
		const items = this.getInputData();
		const operation = this.getNodeParameter('operation', 0);
		let returnItems: INodeExecutionData[] = [];

		if (operation === 'executeQuery') {
			// ----------------------------------
			//         executeQuery
			// ----------------------------------

			try {
				const queryQueue = items.map(async (item, index) => {
					const rawQuery = this.getNodeParameter('query', index) as string;

					return connection.query(rawQuery);
				});

				returnItems = ((await Promise.all(queryQueue)) as mysql2.OkPacket[][]).reduce(
					(collection, result, index) => {
						const [rows] = result;

						const executionData = this.helpers.constructExecutionMetaData(
							this.helpers.returnJsonArray(rows as unknown as IDataObject[]),
							{ itemData: { item: index } },
						);

						collection.push(...executionData);

						return collection;
					},
					[] as INodeExecutionData[],
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnItems = this.helpers.returnJsonArray({ error: error.message });
				} else {
					await connection.end();
					throw error;
				}
			}
		} else if (operation === 'insert') {
			// ----------------------------------
			//         insert
			// ----------------------------------

			try {
				const table = this.getNodeParameter('table', 0, '', { extractValue: true }) as string;
				const columnString = this.getNodeParameter('columns', 0) as string;
				const columns = columnString.split(',').map((column) => column.trim());
				const insertItems = copyInputItems(items, columns);
				const insertPlaceholder = `(${columns.map((_column) => '?').join(',')})`;
				const options = this.getNodeParameter('options', 0);
				const insertIgnore = options.ignore as boolean;
				const insertPriority = options.priority as string;

				const insertSQL = `INSERT ${insertPriority || ''} ${
					insertIgnore ? 'IGNORE' : ''
				} INTO ${table}(${columnString}) VALUES ${items
					.map((_item) => insertPlaceholder)
					.join(',')};`;
				const queryItems = insertItems.reduce(
					(collection: IDataObject[], item) =>
						collection.concat(Object.values(item) as IDataObject[]),
					[],
				);

				const queryResult = await connection.query(insertSQL, queryItems);

				returnItems = this.helpers.returnJsonArray(queryResult[0] as unknown as IDataObject);
			} catch (error) {
				if (this.continueOnFail()) {
					returnItems = this.helpers.returnJsonArray({ error: error.message });
				} else {
					await connection.end();
					throw error;
				}
			}
		} else if (operation === 'update') {
			// ----------------------------------
			//         update
			// ----------------------------------

			try {
				const table = this.getNodeParameter('table', 0, '', {extractValue: true}) as string;
				const updateKey = this.getNodeParameter('updateKey', 0) as string;
				const columnString = this.getNodeParameter('columns', 0) as string;
				const columns = columnString.split(',').map((column) => column.trim());

				if (!columns.includes(updateKey)) {
					columns.unshift(updateKey);
				}

				const updateItems = copyInputItems(items, columns);
				const updateSQL = `UPDATE ${table}
													 SET ${columns
														 .map((column) => `${column} = ?`)
														 .join(',')}
													 WHERE ${updateKey} = ?;`;
				const queryQueue = updateItems.map(async (item) =>
					connection.query(updateSQL, Object.values(item).concat(item[updateKey])),
				);
				const queryResult = await Promise.all(queryQueue);
				returnItems = this.helpers.returnJsonArray(
					queryResult.map((result) => result[0]) as unknown as IDataObject[],
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnItems = this.helpers.returnJsonArray({error: error.message});
				} else {
					await connection.end();
					throw error;
				}
			}
		} else if (operation === 'preparedStatement') {
			try {
				const query = this.getNodeParameter('query', 0, '', {extractValue: true}) as string;
				const columnString = this.getNodeParameter('columns', 0) as string;
				const columns = columnString.split(',').map((column) => column.trim());

				const queryResults = (await Promise.all(items.filter(item => Object.keys(item.json).length > 0).map(item => {
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
		} else {
			if (this.continueOnFail()) {
				returnItems = this.helpers.returnJsonArray({
					error: `The operation "${operation}" is not supported!`,
				});
			} else {
				await connection.end();
				throw new NodeOperationError(
					this.getNode(),
					`The operation "${operation}" is not supported!`,
				);
			}
		}

		await connection.end();

		return this.prepareOutputData(returnItems);
	}
}
