import type {
	ICredentialDataDecryptedObject,
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { IDataObject, NodeOperationError } from 'n8n-workflow';
import {createConnection, copyInputItems, searchTables} from './GenericFunctions';
import type { IExecuteFunctions } from 'n8n-core';
import { OPERATIONS, FIELD_NAMES, FIELD_TYPES, FIELD_MODE_TYPES, PRIORITY } from './lib/constants';
import {
	RecordReturningNodeParameter,
	ReturnItems,
	StringReturningNodeParameter,
} from './interfaces/ReturnParams';

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
				name: FIELD_NAMES.operation,
				type: FIELD_TYPES.options,
				noDataExpression: true,
				options: [
					{
						name: OPERATIONS.executeQuery.name,
						value: OPERATIONS.executeQuery.value,
						description: 'Execute an SQL query',
						action: 'Execute a SQL query',
					},
					{
						name: OPERATIONS.insert.name,
						value: OPERATIONS.insert.value,
						description: 'Insert rows in database',
						action: 'Insert rows in database',
					},
					{
						name: OPERATIONS.update.name,
						value: OPERATIONS.update.value,
						description: 'Update rows in database',
						action: 'Update rows in database',
					},
					{
						name: OPERATIONS.preparedStatement.name,
						value: OPERATIONS.preparedStatement.value,
						description: 'Prepared Statement Execution',
						action: 'Prepared statement',
					},
				],
				default: 'insert',
			},

			// ----------------------------------
			//         preparedStatement
			// ----------------------------------
			{
				displayName: 'Query',
				name: FIELD_NAMES.query,
				type: FIELD_TYPES.string,
				displayOptions: {
					show: {
						operation: [OPERATIONS.preparedStatement.value],
					},
				},
				default: '',
				placeholder: 'SELECT * FROM my_table where ID=?',
				required: true,
				description: 'The SQL query to execute',
			},
			{
				displayName: 'Columns',
				name: FIELD_NAMES.columns,
				type: FIELD_TYPES.string,
				displayOptions: {
					show: {
						operation: [OPERATIONS.preparedStatement.value],
					},
				},
				default: '',
				placeholder: 'id,name,description',
				description: 'Comma-separated list of the properties which should used as params for query',
			},
			{
				displayName: 'Options',
				name: FIELD_NAMES.options,
				type: FIELD_TYPES.collection,
				displayOptions: {
					show: {
						operation: [OPERATIONS.preparedStatement.value],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers',
				options: [
					{
						displayName: 'Bulk',
						name: FIELD_NAMES.bulk,
						type: FIELD_TYPES.boolean,
						default: false,
						description: 'Whether bulk or non-bulk insert/update',
					},
				],
			},
			// ----------------------------------
			//         executeQuery
			// ----------------------------------
			{
				displayName: 'Query',
				name: FIELD_NAMES.query,
				type: FIELD_TYPES.string,
				displayOptions: {
					show: {
						operation: [OPERATIONS.executeQuery.value],
					},
				},
				default: '',
				placeholder: 'SELECT id, name FROM product WHERE id < 40',
				required: true,
				description: 'The SQL query to execute',
			},
			{
				displayName: 'Options',
				name: FIELD_NAMES.options,
				type: 'collection',
				displayOptions: {
					show: {
						operation: [OPERATIONS.executeQuery.value],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers',
				options: [
					{
						displayName: 'Support Big Numbers',
						name: FIELD_NAMES.supportBigNumbers,
						type: FIELD_TYPES.boolean,
						default: false,
						description: 'Whether support big numbers for connection',
					},
				],
			},

			// ----------------------------------
			//         insert
			// ----------------------------------
			{
				displayName: 'Table',
				name: FIELD_NAMES.table,
				type: FIELD_TYPES.resourceLocator,
				default: { mode: FIELD_MODE_TYPES.list, value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: FIELD_NAMES.list,
						type: FIELD_MODE_TYPES.list,
						placeholder: 'Select a Table...',
						typeOptions: {
							searchListMethod: 'searchTables',
							searchFilterRequired: false,
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: FIELD_NAMES.name,
						type: FIELD_MODE_TYPES.string,
						placeholder: 'table_name',
					},
				],
				displayOptions: {
					show: {
						operation: [OPERATIONS.insert.value],
					},
				},
				description: 'Name of the table in which to insert data to',
			},
			{
				displayName: 'Columns',
				name: FIELD_NAMES.columns,
				type: FIELD_TYPES.string,
				displayOptions: {
					show: {
						operation: [OPERATIONS.insert.value],
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
				name: FIELD_NAMES.options,
				type: FIELD_TYPES.collection,
				displayOptions: {
					show: {
						operation: [OPERATIONS.insert.value],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers for INSERT statement',
				options: [
					{
						displayName: 'Ignore',
						name: FIELD_NAMES.ignore,
						type: FIELD_TYPES.boolean,
						default: true,
						description:
							'Whether to ignore any ignorable errors that occur while executing the INSERT statement',
					},
					{
						displayName: 'Priority',
						name: FIELD_NAMES.priority,
						type: FIELD_TYPES.options,
						options: [
							{
								name: 'Low Priority',
								value: PRIORITY.low,
								description:
									'Delays execution of the INSERT until no other clients are reading from the table',
							},
							{
								name: 'High Priority',
								value: PRIORITY.high,
								description:
									'Overrides the effect of the --low-priority-updates option if the server was started with that option. It also causes concurrent inserts not to be used.',
							},
						],
						default: PRIORITY.low,
						description:
							'Ignore any ignorable errors that occur while executing the INSERT statement',
					},
					{
						displayName: 'Support Big Numbers',
						name: FIELD_NAMES.supportBigNumbers,
						type: FIELD_TYPES.boolean,
						default: false,
						description: 'Whether enable support big numbers for connection',
					},
				],
			},

			// ----------------------------------
			//         update
			// ----------------------------------
			{
				displayName: 'Table',
				name: FIELD_NAMES.table,
				type: FIELD_TYPES.resourceLocator,
				default: { mode: FIELD_MODE_TYPES.list, value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: FIELD_NAMES.list,
						type: FIELD_MODE_TYPES.list,
						placeholder: 'Select a Table...',
						typeOptions: {
							searchListMethod: 'searchTables',
							searchFilterRequired: false,
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: FIELD_NAMES.name,
						type: FIELD_MODE_TYPES.string,
						placeholder: 'table_name',
					},
				],
				displayOptions: {
					show: {
						operation: [OPERATIONS.update.value],
					},
				},
				description: 'Name of the table in which to update data in',
			},
			{
				displayName: 'Update Key',
				name: FIELD_NAMES.updateKey,
				type: FIELD_TYPES.string,
				displayOptions: {
					show: {
						operation: [OPERATIONS.update.value],
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
				name: FIELD_NAMES.columns,
				type: FIELD_TYPES.string,
				requiresDataPath: 'multiple',
				displayOptions: {
					show: {
						operation: [OPERATIONS.update.value],
					},
				},
				default: '',
				placeholder: 'name,description',
				description:
					'Comma-separated list of the properties which should used as columns for rows to update',
			},
			{
				displayName: 'Options',
				name: FIELD_NAMES.options,
				type: FIELD_TYPES.collection,
				displayOptions: {
					show: {
						operation: [OPERATIONS.update.value],
					},
				},
				default: {},
				placeholder: 'Add modifiers',
				description: 'Modifiers',
				options: [
					{
						displayName: 'Support Big Numbers',
						name: FIELD_NAMES.supportBigNumbers,
						type: FIELD_TYPES.boolean,
						default: false,
						description: 'Whether support big numbers for connection',
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
		let options = this.getNodeParameter(FIELD_NAMES.options as RecordReturningNodeParameter, 0);
		const supportBigNumbers = !!options?.supportBigNumbers;
		const connection = await createConnection({
			...credentials,
			supportBigNumbers,
			bigNumberStrings: supportBigNumbers,
		});
		const items = this.getInputData();
		const operation = this.getNodeParameter(FIELD_NAMES.operation, 0);

		let returnItems: INodeExecutionData[] = [];

		const getQueryString = (index = 0) =>
			this.getNodeParameter(FIELD_NAMES.query as StringReturningNodeParameter, index);

		const getTable = () =>
			this.getNodeParameter(FIELD_NAMES.table as StringReturningNodeParameter, 0, '', {
				extractValue: true,
			});

		const getColumnString = () =>
			this.getNodeParameter(FIELD_NAMES.columns as StringReturningNodeParameter, 0);

		const getColumns = (columnString: string) =>
			columnString.split(',').map((column) => column.trim());

		const getUpdateKey = () =>
			this.getNodeParameter(FIELD_NAMES.updateKey as StringReturningNodeParameter, 0);

		const executeQuery = async () => {
			const queryQueue = items.map(async (item, index) => connection.query(getQueryString(index)));

			returnItems = (await Promise.all(queryQueue)).reduce((collection, result, index) => {
				const [rows] = result;

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(rows as ReturnItems),
					{ itemData: { item: index } },
				);

				collection.push(...executionData);

				return collection;
			}, [] as INodeExecutionData[]);
		};
		const insert = async () => {
			const table = getTable();
			const columnString = getColumnString();
			const columns = getColumns(columnString);
			const insertItems = copyInputItems(items, columns);
			const insertPlaceholder = `(${columns.map((_column) => '?').join(',')})`;
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

			returnItems = this.helpers.returnJsonArray(queryResult[0] as ReturnItems);
		};
		const update = async () => {
			const table = getTable();
			const updateKey = getUpdateKey();
			const columnString = getColumnString();
			const columns = getColumns(columnString);

			if (!columns.includes(updateKey)) {
				columns.unshift(updateKey);
			}

			const updateItems = copyInputItems(items, columns);
			const updateSQL = `UPDATE ${table}
													 SET ${columns.map((column) => `${column} = ?`).join(',')}
													 WHERE ${updateKey} = ?;`;

			const queryQueue = updateItems.map(async (item) =>
				connection.query(updateSQL, Object.values(item).concat(item[updateKey])),
			);
			const queryResult = await Promise.all(queryQueue);
			returnItems = this.helpers.returnJsonArray(
				queryResult.map((result) => result[0]) as ReturnItems,
			);
		};
		const preparedStatement = async () => {
			const query = getQueryString();
			const columnString = getColumnString();
			const columns = getColumns(columnString);
			const bulk = !!options.bulk;

			const nonEmptyItems = items.filter((item) => Object.keys(item.json).length > 0);

			if (nonEmptyItems.length === 0) {
				await executeQuery();
				return;
			}

			const dbRequests = [];

			if (bulk) {
				const bulkData = nonEmptyItems.flatMap((item) =>
					columns.map((column) =>
						column.startsWith('$') ? column.substring(1) : item.json[column] ?? null,
					),
				);

				dbRequests.push(
					connection
						.query(query, [bulkData])
						.then(([result]) => this.helpers.returnJsonArray(result as ReturnItems)),
				);
			} else {
				for (const [index, item] of nonEmptyItems.entries()) {
					const requestItem = columns.map((column) => item.json[column] ?? null);

					dbRequests.push(
						connection
							.execute(query, requestItem)
							.then(([result]) =>
								this.helpers.constructExecutionMetaData(
									this.helpers.returnJsonArray(result as ReturnItems),
									{ itemData: { item: index } },
								),
							),
					);
				}
			}

			const queryResults = await Promise.all(dbRequests);
			returnItems = queryResults.flatMap((item) => item);
		};
		const errorHandler = async (error: Error) => {
			if (this.continueOnFail()) {
				returnItems = this.helpers.returnJsonArray({ error: error.message });
			} else {
				await connection.end();
				throw error;
			}
		};

		try {
			switch (operation) {
				case OPERATIONS.executeQuery.value:
					await executeQuery();
					break;
				case OPERATIONS.insert.value:
					await insert();
					break;
				case OPERATIONS.update.value:
					await update();
					break;
				case OPERATIONS.preparedStatement.value:
					await preparedStatement();
					break;
				default:
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
		} catch (error) {
			await errorHandler(error);
		}

		await connection.end();

		return this.prepareOutputData(returnItems);
	}
}
