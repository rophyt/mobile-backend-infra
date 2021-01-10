import * as cdk from '@aws-cdk/core';

import * as as from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';
import { Role, LazyRole, Policy, PolicyStatement, ServicePrincipal, CfnInstanceProfile, Effect } from '@aws-cdk/aws-iam';
import * as fs from 'fs';
import * as yaml from 'yaml';

const config = yaml.parse(fs.readFileSync('config.yml', 'utf8'));

export class MobileBackendInfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'rophy_ab2_vpc', {
      vpcName: 'rophy-ab2-vpc'
    });

    const albSecGroup = new ec2.SecurityGroup(this, 'rophy_ab2_alb_sg', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'rophy-ab2-mbackend ALB',
      securityGroupName: 'rophy-ab2-alb-sg'
    });
    albSecGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'http');

    const tg =  new elb.ApplicationTargetGroup(this, 'rophy_ab2_mbackend_tg', {
      targetGroupName: 'rophy-ab2-mbackend-tg',
      targetType: elb.TargetType.INSTANCE,
      vpc: vpc,
      healthCheck: {
        path: '/messages'
      },
      port: 8080
    });


    const alb = new elb.ApplicationLoadBalancer(this, 'rophy_ab2_mbackend_alb', {
      vpc: vpc,
      loadBalancerName: 'rophy-ab2-mbackend-alb',
      internetFacing: true,
      securityGroup: albSecGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
    });

    alb.addListener('rophy_ab2_mbackend_alb_listener', {
      defaultTargetGroups: [tg],
      port: 80
    });


    const securityGroup = new ec2.SecurityGroup(this, 'rophy_ab2_sg', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'mbackend ec2 security group',
      securityGroupName: 'rophy-ab2-mbackend-ec2'
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), 'mbackend service port');
    if (config.bastionSecurityGroup) {
      securityGroup.addIngressRule(
        ec2.SecurityGroup.fromSecurityGroupId(this, 'bastion_sg', config.bastionSecurityGroup),
        ec2.Port.tcp(22),
        'allow ssh from bastion'
      );
    }

    const ec2Role = new Role(this, 'rophy_ab2_mbackend_role', {
      roleName: 'rophy-ab2-mbackend-role',
      assumedBy: new ServicePrincipal('ec2.amazonaws.com')
    });

    const policy = new Policy(this, 'rophy_ab2_mbackend_policy', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: ['s3:Get*', 's3:List*' ]
        })
      ]
    });

    ec2Role.attachInlinePolicy(policy);

    const instanceProfile = new CfnInstanceProfile(this, 'rophy_ab2_mbackend_inst_profile', {
      roles: [ec2Role.roleName]
    })

    const asg = new as.AutoScalingGroup(this, 'rophy_ab2_mbackend_asg', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.lookup({
        name: 'rophy-ab2-mbackend-0002'
      }),
      vpc: vpc,
      allowAllOutbound: true,
      autoScalingGroupName: 'rophy-ab2-mbackend-asg',
      desiredCapacity: 3,
      keyName: config.keyName,
      minCapacity: 1,
      maxCapacity: 6,
      role: ec2Role,
      securityGroup: securityGroup

    });

    asg.attachToApplicationTargetGroup(tg);

  }
}



