const env = Cypress.env()

export default class GetRequest  {

 login(endpoint) {
  const url = `${env.API_BASE_URL}${endpoint}`;
  return cy.api({
    method: 'GET',
    url
  }).then((response) => {
    return response;
  });
}

}
