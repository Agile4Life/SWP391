FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /build/target/*.jar /app/app.jar

ENV SPRING_PROFILES_ACTIVE=supabase
EXPOSE 8080
USER 10001:10001

ENTRYPOINT ["sh", "-c", "exec java -jar /app/app.jar --server.address=0.0.0.0 --server.port=${PORT:-8080}"]
