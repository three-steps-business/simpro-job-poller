'use strict';

const _ = require('lodash')
const request = require("request");
const moment = require('moment')

const simproUrl = process.env.SIMPRO_URL;
const simproApiKey = process.env.SIMPRO_API_KEY;
const integromatHook = process.env.INTEGROMAT_HOOK;

exports.handler = (event, context, callback) => {
    getJobs()
};

function getJobs () {
  var options = {
    method: 'GET',
    url: simproUrl + '/api/v1.0/companies/0/jobs/?columns=ID,DateModified',
    headers:
    {
      Authorization: 'Bearer ' + simproApiKey,
      'Content-Type': 'application/json', 
      'accept': 'application/json'
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    var jobs = JSON.parse(body);
    var newJobs = _.filter(jobs, function(j) {
      var now = moment().format('YYYY-MM-DD');
      var jobModifiedDate = moment(j.DateModified).format('YYYY-MM-DD')
      // console.log(now)
      // console.log(quoteModifiedDate)
      // console.log(quoteModifiedDate == now)
      return jobModifiedDate == now
    });
    console.log('New Jobs', newJobs);

    newJobs.forEach(function(job) {
      getJob(job.ID)
    });
  });
}

function getJob (id) {
  var request = require("request");

  var options = {
    method: 'GET',
    url: simproUrl + '/api/v1.0/companies/0/jobs/' + id + '?columns=ID,Customer,CustomerContact,Salesperson,Technician,DateIssued,Stage,Status,Total,ConvertedFromQuote',
    headers:
    {
      Authorization: 'Bearer ' + simproApiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    var job = JSON.parse(body);
    console.log(job);
    getJobSchedule(job)
  });
}

function getJobSchedule (job) {
  var request = require("request");

  var options = {
    method: 'GET',
    url: simproUrl + '/api/v1.0/companies/0/jobs/' + job.ID + '/timelines/',
    headers:
    {
      Authorization: 'Bearer ' + simproApiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    var timelineArr = JSON.parse(body);
    console.log(timelineArr)
    var schedules = _.filter(timelineArr, function(o) {
       return o.Type == 'Schedule';
    });
    if (!schedules === undefined || !schedules.length == 0) job.Schedule = schedules[0].Date
    getCustomer(job.Customer.ID, job)
  });

}

function getCustomer (id, quote) {
  var request = require("request");

  var options = {
    method: 'GET',
    url:  simproUrl + '/api/v1.0/companies/0/customers/companies/' + id + '?columns=ID,Email,CompanyName,Tags,Phone,Profile',
    headers:
    {
      Authorization: 'Bearer ' + simproApiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    var customer = JSON.parse(body);

    if(customer.errors) {
      getCustomerIndividual(id, quote)
    } else {
      if(customer.Email) {
        if(validEmail(customer.Email)) {
          getCustomerMainContact(customer, quote)
        } else {
          console.log('-- Customer has an invalid email address --')
        }
      } else {
        console.log('-- Customer has no email address --')
      }
    }
  });
}

function getCustomerMainContact (customer, quote) {
  var request = require("request");
  var mainContacts = []

  var options = {
    method: 'GET',
    url:  simproUrl + '/api/v1.0/companies/0/customers/' + customer.ID + '/contacts/',
    headers:
    {
      Authorization: 'Bearer ' + simproApiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error)

    var mainContacts = JSON.parse(body)
    var mainContact = mainContacts[0]

    if(mainContact) { //check if has contacts? - yes? save first contact as first and last name, orgname as company name, and email as company EMAIL
      customer.GivenName = mainContact.GivenName
      customer.FamilyName = mainContact.FamilyName
      customer.CellPhone = mainContact.CellPhone
      postContact(customer, quote)
    } else { // - no? save contact as company firstname and last name, orgname as copmpany name, email as company email
      customer.GivenName = customer.CompanyName
      customer.CellPhone = customer.Phone
      postContact(customer, quote)
    }
  });
}

function getCustomerIndividual (id, quote) {
  var request = require("request");

  var options = {
    method: 'GET',
    url: simproUrl + '/api/v1.0/companies/0/customers/individuals/' + id + '?columns=Email,GivenName,FamilyName,Tags,CellPhone,Profile',
    headers:
    {
      Authorization: 'Bearer ' + simproApiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    var customerIndividual = JSON.parse(body);

    if(customerIndividual.Email) {
      if(validEmail(customerIndividual.Email)) {
        postContact(customerIndividual, quote)
      } else {
        console.log('-- Customer has an invalid email address --')
      }
    } else {
      console.log('-- Customer has no email address --')
    }
  });
}

function postContact (customer, quote) {
  var reqBody = {...customer, ...quote}
  var request = require("request");
  console.log(reqBody);
  var options = {
    method: 'POST',
    url: integromatHook,
    json: true,   // <--Very important!!!
    body: reqBody,
    headers:
    {
      'Content-Type': 'application/json',
      'accept': 'application/json'
    }
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body)
  });
}

function validEmail (email) {
  var regex = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/g;
  return regex.test(email)
}
