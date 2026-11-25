const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests/ui',timeout:90000,workers:1,reporter:[['list'],['html',{open:'never'}]],use:{trace:'retain-on-failure',screenshot:'only-on-failure'}});
