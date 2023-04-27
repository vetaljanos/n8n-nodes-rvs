import { INodePropertyMode, NodePropertyTypes } from 'n8n-workflow';
export const OPERATIONS = {
	executeQuery: { name: 'Execute Query', value: 'executeQuery' },
	insert: { name: 'Insert', value: 'insert' },
	update: { name: 'Update', value: 'update' },
	preparedStatement: { name: 'Prepared Statement', value: 'preparedStatement' },
};
export const FIELD_NAMES = {
	operation: 'operation',
	query: 'query',
	name: 'name',
	columns: 'columns',
	options: 'options',
	bulk: 'bulk',
	supportBigNumbers: 'supportBigNumbers',
	table: 'table',
	ignore: 'ignore',
	priority: 'priority',
	list: 'list',
	updateKey: 'updateKey',
	string: 'string',
};

export const FIELD_TYPES: { [key: string]: NodePropertyTypes } = {
	string: 'string',
	collection: 'collection',
	boolean: 'boolean',
	resourceLocator: 'resourceLocator',
	options: 'options',
};

export const FIELD_MODE_TYPES: { [key: string]: INodePropertyMode['type'] } = {
	string: 'string',
	list: 'list',
};

export const PRIORITY = {
	low: 'LOW_PRIORITY',
	high: 'HIGH_PRIORITY',
};
