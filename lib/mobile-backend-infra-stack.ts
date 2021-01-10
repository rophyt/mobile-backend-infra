import * as cdk from '@aws-cdk/core';

import { CfnAutoScalingGroup, CfnLaunchConfiguration, AutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import { InstanceType, InstanceClass, InstanceSize, SubnetSelection, GenericLinuxImage, Vpc, SecurityGroup, Peer, Port, MachineImage } from '@aws-cdk/aws-ec2';
import { ApplicationTargetGroup } from '@aws-cdk/aws-elasticloadbalancingv2';
import { Role } from '@aws-cdk/aws-iam';
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
      role: Role.fromRoleArn(this, 'rophy_ab2_mbackend_role', config.instanceRoleArn),
      securityGroup: securityGroup

    });

    asg.attachToApplicationTargetGroup(ApplicationTargetGroup.fromTargetGroupAttributes(this, 'rophy-ab2-mbackend-tg', {
      targetGroupArn: config.albTargetGroupArn
    }));
    

    /*
    const launchConfig = new CfnLaunchConfiguration(this, 'rophy_ab2_mbackend_lg', {
      launchConfigurationName: 'rophy-ab2-mbackend-lg',
      imageId: config.imageId,
      instanceType: 't3a.nano',
      iamInstanceProfile: config.iamInstanceProfile,
      keyName: config.keyName,
      securityGroups: [securityGroup.uniqueId]
    });
    launchConfig.cfnOptions.deletionPolicy = cdk.CfnDeletionPolicy.DELETE;

    const asg = new CfnAutoScalingGroup(this, 'rophy_ab2_backend_asg', {
      autoScalingGroupName: 'rophy-ab2-mbackend-asg',
      maxSize: '6',
      minSize: '1',
      launchConfigurationName: launchConfig.launchConfigurationName,
      availabilityZones: config.availabilityZones,
      loadBalancerNames: [config.loadBalancerNames]
    });
    asg.cfnOptions.deletionPolicy = cdk.CfnDeletionPolicy.DELETE;
    asg.addDependsOn(launchConfig);
    */
  }
}



