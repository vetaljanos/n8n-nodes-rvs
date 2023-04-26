import { IDataObject } from 'n8n-workflow';
import { RowDataPacket } from 'mysql2';

export type StringReturningNodeParameter =
	| 'binaryProperty'
	| 'binaryPropertyName'
	| 'binaryPropertyOutput'
	| 'dataPropertyName'
	| 'dataBinaryProperty'
	| 'resource'
	| 'operation'
	| 'filePath'
	| 'encodingType';

export type RecordReturningNodeParameter =
	| 'additionalFields'
	| 'filters'
	| 'options'
	| 'updateFields';

export type ReturnItems = IDataObject[] & RowDataPacket[][];
