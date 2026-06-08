/*
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH under
 * one or more contributor license agreements. See the NOTICE file distributed
 * with this work for additional information regarding copyright ownership.
 * Licensed under the Camunda License 1.0. You may not use this file
 * except in compliance with the Camunda License 1.0.
 */
package io.camunda.it.auth;

import static io.camunda.client.api.search.enums.PermissionType.CREATE;
import static io.camunda.client.api.search.enums.PermissionType.CREATE_PROCESS_INSTANCE;
import static io.camunda.client.api.search.enums.PermissionType.READ_PROCESS_DEFINITION;
import static io.camunda.client.api.search.enums.PermissionType.READ_PROCESS_INSTANCE;
import static io.camunda.client.api.search.enums.PermissionType.UPDATE_PROCESS_INSTANCE;
import static io.camunda.client.api.search.enums.ResourceType.PROCESS_DEFINITION;
import static io.camunda.client.api.search.enums.ResourceType.RESOURCE;
import static io.camunda.it.util.TestHelper.deployProcessAndWaitForIt;
import static io.camunda.it.util.TestHelper.startProcessInstance;
import static io.camunda.it.util.TestHelper.waitForAgentInstanceToBeIndexed;
import static io.camunda.it.util.TestHelper.waitForElementInstances;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.AssertionsForClassTypes.assertThatExceptionOfType;

import io.camunda.client.CamundaClient;
import io.camunda.client.api.command.ProblemException;
import io.camunda.qa.util.auth.Authenticated;
import io.camunda.qa.util.auth.Permissions;
import io.camunda.qa.util.auth.TestUser;
import io.camunda.qa.util.auth.UserDefinition;
import io.camunda.qa.util.multidb.MultiDbTest;
import io.camunda.qa.util.multidb.MultiDbTestApplication;
import io.camunda.zeebe.model.bpmn.Bpmn;
import io.camunda.zeebe.protocol.impl.record.value.job.JobRecord;
import io.camunda.zeebe.qa.util.cluster.TestStandaloneBroker;
import java.util.List;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledIfSystemProperty;

@MultiDbTest
@DisabledIfSystemProperty(named = "test.integration.camunda.database.type", matches = "AWS_OS")
class AgentInstanceAuthorizationIT {

  private static final String AGENT_ELEMENT_ID = "agentAuthElement";
  private static final String PROCESS_ID_1 = "agentAuthProcess1";
  private static final String PROCESS_ID_2 = "agentAuthProcess2";
  private static final String ADMIN = "admin";
  private static final String USER1 = "user1";
  private static final String USER2 = "user2";

  @MultiDbTestApplication
  private static final TestStandaloneBroker BROKER =
      new TestStandaloneBroker().withBasicAuth().withAuthorizationsEnabled();

  @UserDefinition
  private static final TestUser ADMIN_USER =
      new TestUser(
          ADMIN,
          "password",
          List.of(
              new Permissions(RESOURCE, CREATE, List.of("*")),
              new Permissions(PROCESS_DEFINITION, CREATE_PROCESS_INSTANCE, List.of("*")),
              new Permissions(PROCESS_DEFINITION, READ_PROCESS_DEFINITION, List.of("*")),
              new Permissions(PROCESS_DEFINITION, READ_PROCESS_INSTANCE, List.of("*")),
              new Permissions(PROCESS_DEFINITION, UPDATE_PROCESS_INSTANCE, List.of("*"))));

  // user1 may read agent instances of PROCESS_ID_1 only
  @UserDefinition
  private static final TestUser USER1_USER =
      new TestUser(
          USER1,
          "password",
          List.of(
              new Permissions(PROCESS_DEFINITION, READ_PROCESS_INSTANCE, List.of(PROCESS_ID_1))));

  // user2 may read agent instances of PROCESS_ID_2 only
  @UserDefinition
  private static final TestUser USER2_USER =
      new TestUser(
          USER2,
          "password",
          List.of(
              new Permissions(PROCESS_DEFINITION, READ_PROCESS_INSTANCE, List.of(PROCESS_ID_2))));

  private static long agentInstanceKey1;
  private static long agentInstanceKey2;

  @BeforeAll
  static void setUp(@Authenticated(ADMIN) final CamundaClient adminClient) {
    // Deploy two processes, each with one agent instance
    agentInstanceKey1 = createAgentInstance(adminClient, PROCESS_ID_1);
    agentInstanceKey2 = createAgentInstance(adminClient, PROCESS_ID_2);
    waitForAgentInstanceToBeIndexed(adminClient, agentInstanceKey1);
    waitForAgentInstanceToBeIndexed(adminClient, agentInstanceKey2);
  }

  // ── search ────────────────────────────────────────────────────────────────

  @Test
  void searchShouldReturnOnlyAuthorizedAgentInstances(
      @Authenticated(USER1) final CamundaClient camundaClient) {
    // when
    final var result = camundaClient.newAgentInstanceSearchRequest().execute();

    // then
    assertThat(result.items()).hasSize(1);
    assertThat(result.items().getFirst().getAgentInstanceKey()).isEqualTo(agentInstanceKey1);
  }

  @Test
  void searchShouldNotReturnUnauthorizedAgentInstances(
      @Authenticated(USER1) final CamundaClient camundaClient) {
    // when — user1 filters explicitly on the process they cannot read
    final var result =
        camundaClient
            .newAgentInstanceSearchRequest()
            .filter(f -> f.processDefinitionId(PROCESS_ID_2))
            .execute();

    // then
    assertThat(result.items()).isEmpty();
  }

  @Test
  void searchShouldReturnAllAgentInstancesForAdmin(
      @Authenticated(ADMIN) final CamundaClient camundaClient) {
    // when
    final var result = camundaClient.newAgentInstanceSearchRequest().execute();

    // then — admin sees both instances
    assertThat(result.items()).hasSize(2);
  }

  // ── getByKey ──────────────────────────────────────────────────────────────

  @Test
  void getByKeyShouldReturnAuthorizedAgentInstance(
      @Authenticated(USER1) final CamundaClient camundaClient) {
    // when
    final var result = camundaClient.newAgentInstanceGetRequest(agentInstanceKey1).execute();

    // then
    assertThat(result).isNotNull();
    assertThat(result.getAgentInstanceKey()).isEqualTo(agentInstanceKey1);
    assertThat(result.getProcessDefinitionId()).isEqualTo(PROCESS_ID_1);
  }

  @Test
  void getByKeyShouldReturn403ForUnauthorizedAgentInstance(
      @Authenticated(USER1) final CamundaClient camundaClient) {
    // when
    final ThrowingCallable executeGet =
        () -> camundaClient.newAgentInstanceGetRequest(agentInstanceKey2).execute();

    // then
    final var problemException =
        assertThatExceptionOfType(ProblemException.class).isThrownBy(executeGet).actual();
    assertThat(problemException.code()).isEqualTo(403);
    assertThat(problemException.details().getDetail())
        .isEqualTo(
            "Unauthorized to perform operation 'READ_PROCESS_INSTANCE' on resource"
                + " 'PROCESS_DEFINITION'");
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private static long createAgentInstance(final CamundaClient adminClient, final String processId) {
    final var processModel =
        Bpmn.createExecutableProcess(processId)
            .startEvent()
            .adHocSubProcess(AGENT_ELEMENT_ID, p -> p.task("agentTask"))
            .zeebeJobType(JobRecord.IO_CAMUNDA_AI_AGENT_JOB_WORKER_TYPE_PREFIX)
            .moveToActivity(AGENT_ELEMENT_ID)
            .endEvent()
            .done();

    deployProcessAndWaitForIt(adminClient, processModel, processId + ".bpmn");

    final var pi = startProcessInstance(adminClient, processId);
    final long processInstanceKey = pi.getProcessInstanceKey();

    waitForElementInstances(
        adminClient, f -> f.elementId(AGENT_ELEMENT_ID).processInstanceKey(processInstanceKey), 1);

    final var elementInstanceKey =
        adminClient
            .newElementInstanceSearchRequest()
            .filter(f -> f.elementId(AGENT_ELEMENT_ID).processInstanceKey(processInstanceKey))
            .execute()
            .items()
            .getFirst()
            .getElementInstanceKey();

    return adminClient
        .newCreateAgentInstanceCommand()
        .elementInstanceKey(elementInstanceKey)
        .model("gpt-4o")
        .provider("openai")
        .systemPrompt("You are a helpful assistant.")
        .execute()
        .getAgentInstanceKey();
  }
}
