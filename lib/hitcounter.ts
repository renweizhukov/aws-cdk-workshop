import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface HitCounterProps {
    /** the function for which we want to count url hits **/
    downstream: lambda.IFunction;

    /**
     * The read capacity units for the table
     *
     * Must be greater than 5 and lower than 20
     *
     * @default 5
     */
    readCapacity?: number;
}

export class HitCounter extends Construct {
    /** allows accessing the counter function **/
    public readonly handler: lambda.Function;

    /** the hit counter table **/
    public readonly table: dynamodb.Table;

    constructor(scope: Construct, id: string, props: HitCounterProps) {
        if (props.readCapacity !== undefined && (props.readCapacity < 5 || props.readCapacity > 20)) {
            throw new Error('readCapacity must be greater than 5 and less than 20');
        }

        super(scope, id);

        this.table = new dynamodb.Table(this, 'Hits', {
            partitionKey: { 
                name: 'path',
                type: dynamodb.AttributeType.STRING 
            },
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            readCapacity: props.readCapacity ?? 5,
            removalPolicy: RemovalPolicy.DESTROY
        });

        this.handler = new lambda.Function(this, 'HitCounterHandler', {
            // NodeJS 18.x runtime does not come with version 2 of AWS SDK, so
            // we downgrade NodeJS to 16.x to avoid the import error: "Cannot
            // find module 'aws-sdk'".
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'hitcounter.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                DOWNSTREAM_FUNCTION_NAME: props.downstream.functionName,
                HITS_TABLE_NAME: this.table.tableName
            }
        });

        // grant the lambda role read/write permissions to our table
        this.table.grantReadWriteData(this.handler);

        // grant the lambda role invoke permissions to the downstream function
        props.downstream.grantInvoke(this.handler);
    }
}