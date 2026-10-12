plugins {
    kotlin("jvm") version "2.2.20"
    kotlin("plugin.serialization") version "2.2.20"
    `maven-publish`
}

group = "dev.lingva"
version = "0.1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    testImplementation(kotlin("test-junit5"))
}

kotlin {
    jvmToolchain(17)
}

java {
    withSourcesJar()
}

publishing {
    publications {
        create<MavenPublication>("lingva") {
            from(components["java"])
            artifactId = "lingva-kotlin"
            pom {
                name = "Lingva for Kotlin"
                description = "Kotlin adapter for versioned Lingva locale bundles."
                url = "https://github.com/usausoft/lingva"
                licenses {
                    license {
                        name = "Lingva Proprietary License"
                        url = "https://github.com/usausoft/lingva/blob/main/LICENSE.md"
                        distribution = "repo"
                    }
                }
                developers {
                    developer {
                        id = "yury-saukou"
                        name = "Yury Saukou"
                    }
                }
                scm {
                    connection = "scm:git:https://github.com/usausoft/lingva.git"
                    developerConnection = "scm:git:ssh://git@github.com/usausoft/lingva.git"
                    url = "https://github.com/usausoft/lingva"
                }
            }
        }
    }
}

sourceSets {
    test {
        resources.srcDir("../fixtures")
    }
}

tasks.test {
    useJUnitPlatform()
}
