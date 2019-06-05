#!/usr/bin/env groovy
@Library('utils') _

pipeline {

  agent {
    docker {
      image "node:11"
    }
  }

  stages {
    stage('PREPARE'){
      steps{
        nodejs(nodeJSInstallationName: 'node_11') {
          sh 'echo "- INSTALL NODE_MODULES"'
          sh 'npm i'
        }
      }
    }
    stage('MOUNT PRIVATE KEY') {
      steps{
        withCredentials([string(credentialsId: 'kovan_id', variable: 'KOVAN_KEY')]) {
            sh '''echo "$KOVAN_KEY" > private.key'''
        } 
      }
    }
    stage('DEPLOY KOVAN'){
      steps{
        nodejs(nodeJSInstallationName: 'node_11') {
          sh 'npm run migration:kovan'
        }
      }
    }
  }

  environment {
    PROJECT   = 'herotoken-smartcontract'
    DEPLOY_TO = utils.deployToByEnv()
    VERSION   = utils.calculateEnvVersion()
  }

  options {
    disableConcurrentBuilds()
  }

  post {
    failure { script{ utils.nFailure() } }
    fixed { script { utils.nFixed() } }
    unstable { script { utils.nUnstable() } }
    success { script { utils.nSuccess() } }
    cleanup { script{ cleanWs() } }
  }
}
