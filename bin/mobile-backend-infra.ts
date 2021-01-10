#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MobileBackendInfraStack } from '../lib/mobile-backend-infra-stack';
import * as fs from 'fs';
import * as yaml from 'yaml';

const config = yaml.parse(fs.readFileSync('config.yml', 'utf8'));

const app = new cdk.App();
new MobileBackendInfraStack(app, 'MobileBackendInfraStack', {
    env: {
        account: config.account,
        region: config.region
    }
});
