import * as cdk from '@aws-cdk/core';

import { CfnAutoScalingGroup, CfnLaunchConfiguration, AutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import { InstanceType, InstanceClass, InstanceSize, SubnetSelection, GenericLinuxImage, Vpc, SecurityGroup, Peer, Port, MachineImage } from '@aws-cdk/aws-ec2';
import { ApplicationTargetGroup } from '@aws-cdk/aws-elasticloadbalancingv2';
import { Role, LazyRole, Policy, PolicyStatement, ServicePrincipal, CfnInstanceProfile, Effect } from '@aws-cdk/aws-iam';
import * as fs from 'fs';
import * as yaml from 'yaml';

const config = yaml.parse(fs.readFileSync('config.yml', 'utf8'));

export class MobileBackendInfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'rophy_ab2_vpc', {
      vpcName: 'rophy-ab2-vpc'
    });

    const securityGroup = new SecurityGroup(this, 'rophy_ab2_sg', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'mbackend ec2 security group',
      securityGroupName: 'rophy-ab2-mbackend-ec2'
    });
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(8080), 'mbackend service port');
    if (config.bastionSecurityGroup) {
      securityGroup.addIngressRule(
        SecurityGroup.fromSecurityGroupId(this, 'bastion_sg', config.bastionSecurityGroup),
        Port.tcp(22),
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

    const asg = new AutoScalingGroup(this, 'rophy_ab2_mbackend_asg', {
      instanceType: InstanceType.of(InstanceClass.T3A, InstanceSize.NANO),
      machineImage: MachineImage.lookup({
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

    asg.attachToApplicationTargetGroup(ApplicationTargetGroup.fromTargetGroupAttributes(this, 'rophy-ab2-mbackend-tg', {
      targetGroupArn: config.albTargetGroupArn
    }));

  }
}



