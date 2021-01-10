#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MobileBackendInfraStack } from '../lib/mobile-backend-infra-stack';

const app = new cdk.App();
new MobileBackendInfraStack(app, 'MobileBackendInfraStack');
