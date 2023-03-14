import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface HitCounterProps {
    /** the function for which we want to count url hits **/
    downstream: lambda.IFunction;
}

export class HitCounter extends Construct {
    /** allows accessing the counter function **/
    public readonly handler: lambda.Function;

    /** the hit counter table **/
    public readonly table: dynamodb.Table;

    constructor(scope: Construct, id: string, props: HitCounterProps) {
        super(scope, id);

        this.table = new dynamodb.Table(this, 'Hits', {
            partitionKey: { 
                name: 'path',
                type: dynamodb.AttributeType.STRING 
            },
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